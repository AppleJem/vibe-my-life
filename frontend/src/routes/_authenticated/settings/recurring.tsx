import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { DatePicker } from '../../../components/ExpenseTracker/AddExpenseModal/DatePicker'
import { Calculator } from '../../../components/ExpenseTracker/AddExpenseModal/Calculator'
import { CategoryPicker } from '../../../components/ExpenseTracker/AddExpenseModal/CategoryPicker'
import { TextAreaInput } from '../../../components/ExpenseTracker/AddExpenseModal/TextAreaInput'
import { FrequencyPicker } from '../../../components/ExpenseTracker/AddExpenseModal/FrequencyPicker'
import { TypeToggle } from '../../../components/TypeToggle'
import { ChoiceDialog } from '../../../components/ChoiceDialog'
import { displayCategory } from '../../../constants/categories'
import { useCurrency } from '../../../contexts/MetadataContext'
import { useRecurringRules } from '../../../hooks/useRecurring'
import { formatAmount, formatRate, toBase } from '../../../utils/currency'
import { FREQUENCY_LABEL, formatDate, localToday, nextRunDate } from '../../../utils/recurring'
import type {
  RecurringFrequency,
  RecurringRule,
  RecurringRuleInput,
  TransactionType,
} from '../../../types/expense'

export const Route = createFileRoute('/_authenticated/settings/recurring')({
  component: RecurringSettingsPage,
})

function RecurringSettingsPage() {
  const navigate = useNavigate()
  const { rules, loading, error, createRule, updateRule, deleteRule } = useRecurringRules()

  // `'new'` is a blank editor; a rule is an edit. Both replace the list in place rather
  // than pushing a route — the list is the editor's "back".
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)

  if (editing) {
    return (
      <RuleEditor
        rule={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onCreate={createRule}
        onUpdate={updateRule}
        onDelete={deleteRule}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate({ to: '/settings' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Recurring Items</h2>
      </div>

      <p className="text-sm text-zinc-500 mb-6">
        Subscriptions and regular income. Each one is added to your ledger automatically when
        it comes due — including any that were missed while the app was closed.
      </p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">
            Nothing recurring yet. Add one here, or pick a frequency when saving a new entry.
          </p>
        ) : (
          rules.map((rule) => <RuleRow key={rule.id} rule={rule} onClick={() => setEditing(rule)} />)
        )}
      </div>

      <button
        onClick={() => setEditing('new')}
        className="mt-4 w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Add recurring item
      </button>
    </div>
  )
}

function RuleRow({ rule, onClick }: { rule: RecurringRule; onClick: () => void }) {
  const { baseCurrency } = useCurrency()
  const income = rule.type === 'income'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-4 border-b border-zinc-800 last:border-b-0 text-left hover:bg-zinc-800 transition-colors"
    >
      <div className="min-w-0">
        <p className="truncate text-zinc-100 font-medium">{displayCategory(rule.category)}</p>
        <p className="truncate text-sm text-zinc-500">
          {rule.note ? `${rule.note} · ` : ''}
          {FREQUENCY_LABEL[rule.frequency]} · next {formatDate(nextRunDate(rule))}
        </p>
      </div>
      <span className={`shrink-0 font-semibold ${income ? 'text-lime-400' : 'text-zinc-100'}`}>
        {income ? '+' : '−'}
        {formatAmount(rule.amount, rule.baseCurrency ?? baseCurrency)}
      </span>
    </button>
  )
}

type SaveScope = 'future' | 'all'
type DeleteScope = 'keep' | 'purge'

interface RuleEditorProps {
  /** null = creating a new rule. */
  rule: RecurringRule | null
  onClose: () => void
  onCreate: (input: RecurringRuleInput) => Promise<unknown>
  onUpdate: (args: {
    id: string
    input: RecurringRuleInput
    propagate: SaveScope
    from?: string
  }) => Promise<unknown>
  onDelete: (args: { id: string; deleteItems: boolean }) => Promise<unknown>
}

/**
 * The whole rule on one scrolling page, rather than the add-modal's one-field-at-a-time
 * wizard: editing a schedule is a rarer, more deliberate act than logging a coffee, and
 * seeing every field at once is what makes "what exactly am I changing?" answerable
 * before the propagation prompt appears.
 */
function RuleEditor({ rule, onClose, onCreate, onUpdate, onDelete }: RuleEditorProps) {
  const { baseCurrency, currencies, rates } = useCurrency()
  const today = localToday()

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense')
  const [frequency, setFrequency] = useState<RecurringFrequency>(rule?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(rule?.startDate ?? today)
  // As typed, in `currency` — the same convention as the add modal.
  const [amount, setAmount] = useState(rule?.originalAmount ?? rule?.amount ?? 0)
  const [currency, setCurrency] = useState(rule?.currency ?? rule?.baseCurrency ?? baseCurrency)
  const [category, setCategory] = useState(rule?.category ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
  const [remarks, setRemarks] = useState(rule?.remarks ?? '')

  const [saveScopeOpen, setSaveScopeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForeign = currency !== baseCurrency

  // Reuse the rate the rule was saved at while the pair is unchanged, so renaming a
  // subscription never silently re-prices it at today's rate.
  const storedRateApplies =
    rule?.currency === currency && rule?.baseCurrency === baseCurrency && rule?.rate != null

  const rate = storedRateApplies ? rule!.rate! : rates[currency]
  const canConvert = !isForeign || (typeof rate === 'number' && rate > 0)
  const baseAmount = isForeign && canConvert ? toBase(amount, rate!, baseCurrency) : amount

  const canSave = amount > 0 && !!category && canConvert

  const input = (): RecurringRuleInput => ({
    type,
    frequency,
    startDate,
    amount: baseAmount,
    category,
    note,
    remarks,
    baseCurrency,
    currency: isForeign ? currency : null,
    originalAmount: isForeign ? amount : null,
    rate: isForeign ? rate! : null,
  })

  const handleSave = () => {
    if (!canSave) return
    // A brand-new rule has no history to reconcile, so it saves without a question.
    if (!rule) {
      void run(() => onCreate(input()))
      return
    }
    setSaveScopeOpen(true)
  }

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to save. Please try again.')
      setIsBusy(false)
    }
  }

  const selectType = (next: TransactionType) => {
    if (next === type) return
    setType(next)
    // The two category lists are independent — there is no translating "🍜 Food".
    setCategory('')
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">
          {rule ? 'Edit recurring item' : 'New recurring item'}
        </h2>
      </div>

      <div className="flex flex-col gap-6 pb-28">
        <Section label="Type">
          <TypeToggle value={type} onChange={selectType} />
        </Section>

        <Section label="Repeats">
          <FrequencyPicker
            value={frequency}
            // "One-time" is not a schedule; a rule always has a frequency, so the null
            // option is simply ignored here.
            onChange={(next) => next && setFrequency(next)}
            type={type}
          />
        </Section>

        <Section
          label="Starts on"
          hint={
            rule
              ? `Next run ${formatDate(nextRunDate({ ...rule, frequency, startDate }, today))}. Changing the schedule takes effect from today onwards — past entries stay where they are.`
              : `First entry on ${formatDate(startDate)}${startDate > today ? '' : ', added straight away'}.`
          }
        >
          <DatePicker value={startDate} onChange={setStartDate} />
        </Section>

        <Section label="Amount">
          {currencies.length > 1 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
              {currencies.map((code) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  disabled={code !== baseCurrency && Object.keys(rates).length === 0}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    code === currency
                      ? type === 'income'
                        ? 'bg-lime-500 text-zinc-950'
                        : 'bg-pink-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
          <Calculator value={amount} onChange={setAmount} currency={currency} />
          {isForeign && (
            <p className="mt-2 px-1 text-xs text-zinc-500">
              {canConvert
                ? `Every entry is saved as ${formatAmount(baseAmount, baseCurrency)} · ${formatRate(baseCurrency, currency, rate!)}. The rate is fixed until you edit this item.`
                : 'Exchange rate unavailable — connect to the internet to use this currency.'}
            </p>
          )}
        </Section>

        <Section label="Category">
          <CategoryPicker value={category} onChange={setCategory} type={type} />
        </Section>

        <Section label="Note">
          <TextAreaInput
            value={note}
            onChange={setNote}
            label="Note (optional)"
            placeholder={type === 'income' ? 'Where does this come from?' : 'What is this for?'}
          />
        </Section>

        <Section label="Remarks">
          <TextAreaInput
            value={remarks}
            onChange={setRemarks}
            label="Remarks (optional)"
            placeholder="Longer comments, context, or a description…"
            rows={4}
          />
        </Section>

        {rule && (
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={isBusy}
            className="w-full rounded-xl bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            Delete recurring item
          </button>
        )}
      </div>

      {/* Save bar, matching the currency and categories pages */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!canSave || isBusy}
            className="w-full rounded-lg bg-pink-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-shadow hover:shadow-pink-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? 'Saving…' : rule ? 'Save changes' : 'Create recurring item'}
          </button>
        </div>
      </div>

      <ChoiceDialog
        isOpen={saveScopeOpen}
        title="Apply to past entries too?"
        message="Entries this item has already created can keep their old values, or be rewritten to match."
        choices={[
          {
            key: 'future',
            label: 'Future entries only',
            description: 'Anything already in your ledger stays as it is',
          },
          {
            key: 'all',
            label: 'Also update past entries',
            description: 'Rewrites every entry this item has created',
          },
        ]}
        isBusy={isBusy}
        onSelect={(scope: SaveScope) =>
          void run(() =>
            onUpdate({ id: rule!.id, input: input(), propagate: scope, from: today })
          )
        }
        onCancel={() => setSaveScopeOpen(false)}
      />

      <ChoiceDialog
        isOpen={deleteOpen}
        title="Delete this recurring item?"
        message="Nothing new will be added after this. Entries it has already created are yours to keep or clear."
        choices={[
          {
            key: 'keep',
            label: 'Stop future entries only',
            description: 'Keeps everything already in your ledger',
          },
          {
            key: 'purge',
            label: 'Also delete past entries',
            description: 'Removes every entry this item has created',
            tone: 'danger',
          },
        ]}
        isBusy={isBusy}
        onSelect={(scope: DeleteScope) =>
          void run(() => onDelete({ id: rule!.id, deleteItems: scope === 'purge' }))
        }
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

function Section({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {children}
      {hint && <p className="mt-2 px-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
