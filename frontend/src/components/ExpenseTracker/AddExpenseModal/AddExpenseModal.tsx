import { useEffect, useState } from 'react'
import { DatePicker } from './DatePicker'
import { Calculator } from './Calculator'
import { CategoryPicker } from './CategoryPicker'
import { TextAreaInput } from './TextAreaInput'
import { FrequencyPicker, type FrequencyValue } from './FrequencyPicker'
import { TypeToggle } from '../../TypeToggle'
import { ChoiceDialog } from '../../ChoiceDialog'
import { displayCategory } from '../../../constants/categories'
import { useCurrency } from '../../../contexts/MetadataContext'
import { useRecurringRules } from '../../../hooks/useRecurring'
import { formatAmount, formatRate, toBase } from '../../../utils/currency'
import { FREQUENCY_LABEL, formatDate } from '../../../utils/recurring'
import { typeOf } from '../../../utils/transaction'
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  Expense,
  RecurringRuleInput,
  TransactionType,
} from '../../../types/expense'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
  expense?: Expense | null
  onUpdate?: (id: string, date: string, updates: UpdateExpenseInput) => Promise<void>
}

type Field = 'date' | 'amount' | 'category' | 'note' | 'remarks' | 'recurring'

const FIELDS: { key: Field; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'recurring', label: 'Recurring' },
]

/**
 * Fields that may be left blank. Confirm has to stay enabled on these — before
 * remarks existed, note was last and fell through to the save path, so nothing
 * ever had to skip past an empty optional field. `recurring` qualifies because
 * "one-time" is a real answer, not an empty one.
 */
const OPTIONAL_FIELDS: Field[] = ['note', 'remarks', 'recurring']

/** How far an edit to one occurrence of a recurring rule reaches. */
type EditScope = 'one' | 'future' | 'all'

/**
 * Accent per type, spelled out because Tailwind only keeps class names it can see in
 * the source. Expense stays the app's pink; income borrows the lime already reserved
 * for money-in indicators.
 */
const ACCENT: Record<TransactionType, { text: string; hover: string; button: string }> = {
  expense: {
    text: 'text-pink-500',
    hover: 'hover:text-pink-400',
    button: 'bg-pink-500 text-white shadow-pink-500/25 hover:shadow-pink-500/40',
  },
  income: {
    text: 'text-lime-400',
    hover: 'hover:text-lime-300',
    button: 'bg-lime-500 text-zinc-950 shadow-lime-500/25 hover:shadow-lime-500/40',
  },
}

const NOUN: Record<TransactionType, string> = { expense: 'Expense', income: 'Income' }

export function AddExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  expense,
  onUpdate,
}: AddExpenseModalProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const isEditMode = !!expense

  const { baseCurrency, currencies, rates, inputCurrency, setInputCurrency } = useCurrency()
  const { rules, createRule, updateRule } = useRecurringRules()

  // The schedule behind the occupied row, when there is one. Editing a generated row is
  // partly an edit of its rule, so the modal needs the rule's frequency and start date.
  const rule = expense?.recurringId
    ? rules.find((r) => r.id === expense.recurringId)
    : undefined

  const [activeField, setActiveField] = useState<Field>('date')
  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState(todayStr)
  // The amount as typed, in `currency` — not necessarily the base currency.
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState(baseCurrency)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [remarks, setRemarks] = useState('')
  const [frequency, setFrequency] = useState<FrequencyValue>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)

  // Load the expense being edited (or a blank form) each time the modal opens
  useEffect(() => {
    if (!isOpen) return
    setType(expense ? typeOf(expense) : 'expense')
    setDate(expense?.date ?? todayStr)
    setAmount(expense?.originalAmount ?? expense?.amount ?? 0)
    setCurrency(expense?.currency ?? expense?.baseCurrency ?? inputCurrency)
    setCategory(expense?.category ?? '')
    setNote(expense?.note ?? '')
    setRemarks(expense?.remarks ?? '')
    setFrequency(null)
    setActiveField('date')
    setScopeOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, expense])

  const isForeign = currency !== baseCurrency

  // Reuse the rate the expense was saved at whenever the currency pair is unchanged,
  // so editing a note never silently re-prices an old expense at today's rate.
  const storedRateApplies =
    isEditMode &&
    expense?.currency === currency &&
    expense?.baseCurrency === baseCurrency &&
    expense?.rate != null

  const rate = storedRateApplies ? expense!.rate! : rates[currency]
  const canConvert = !isForeign || (typeof rate === 'number' && rate > 0)

  const baseAmount = isForeign && canConvert ? toBase(amount, rate!, baseCurrency) : amount

  const canSave = !!date && amount > 0 && !!category && canConvert

  const accent = ACCENT[type]

  // The category belongs to whichever list was active, so switching direction has to
  // drop it — there is no meaningful translation from "🍜 Food" to an income category.
  const selectType = (next: TransactionType) => {
    if (next === type) return
    setType(next)
    setCategory('')
  }

  const selectCurrency = (code: string) => {
    setCurrency(code)
    // Remembered for the next entry — travelling shouldn't mean reselecting every time.
    setInputCurrency(code)
  }

  const fieldSummary = (key: Field) => {
    switch (key) {
      case 'date': {
        if (date === todayStr) return 'Today'
        const [y, m, d] = date.split('-').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      }
      case 'amount': {
        if (amount <= 0) return '—'
        const typed = formatAmount(amount, currency)
        if (!isForeign) return typed
        return canConvert
          ? `${typed} · ${formatAmount(baseAmount, baseCurrency)}`
          : `${typed} · no rate`
      }
      case 'category':
        return category ? displayCategory(category) : '—'
      case 'note':
        return note.trim() || '—'
      case 'remarks':
        return remarks.trim() || '—'
      case 'recurring':
        if (rule) return `${FREQUENCY_LABEL[rule.frequency]} · since ${formatDate(rule.startDate)}`
        if (isEditMode) return 'One-time'
        return frequency ? FREQUENCY_LABEL[frequency] : 'One-time'
    }
  }

  const isFilled = (key: Field) => {
    switch (key) {
      case 'date':
        return !!date
      case 'amount':
        return amount > 0 && canConvert
      case 'category':
        return !!category
      case 'note':
        return !!note.trim()
      case 'remarks':
        return !!remarks.trim()
      case 'recurring':
        // "One-time" is as much of an answer as "Monthly", so this row never greys out.
        return true
    }
  }

  const activeIndex = FIELDS.findIndex((f) => f.key === activeField)
  const isLastField = activeIndex === FIELDS.length - 1
  const canAdvance = isFilled(activeField) || OPTIONAL_FIELDS.includes(activeField)

  const confirmField = () => {
    if (isLastField) {
      handleSubmit()
      return
    }
    setActiveField(FIELDS[activeIndex + 1].key)
  }

  // Explicit nulls clear the stored foreign fields when an entry is edited back to the
  // base currency; the create path spreads them in only when they apply.
  const foreignUpdate = {
    currency: isForeign ? currency : null,
    originalAmount: isForeign ? amount : null,
    rate: isForeign ? rate! : null,
  }

  const expenseUpdate = (): UpdateExpenseInput => ({
    date,
    amount: baseAmount,
    type,
    category,
    note,
    remarks,
    baseCurrency,
    ...foreignUpdate,
  })

  /** The form's values as a schedule. Frequency and start date belong to the rule. */
  const ruleInput = (): RecurringRuleInput => ({
    type,
    frequency: frequency ?? rule!.frequency,
    startDate: rule?.startDate ?? date,
    amount: baseAmount,
    category,
    note,
    remarks,
    baseCurrency,
    ...foreignUpdate,
  })

  /**
   * Has anything the *schedule* owns changed? `date` is deliberately excluded: moving
   * one month's payment a few days is a fact about that payment, never about the rule,
   * so it goes through without a prompt.
   */
  const templateChanged =
    !!expense &&
    (baseAmount !== expense.amount ||
      category !== expense.category ||
      note !== expense.note ||
      remarks !== (expense.remarks ?? '') ||
      (isForeign ? currency : null) !== (expense.currency ?? null))

  const handleSubmit = async () => {
    if (!canSave) return

    // Editing a generated row can mean three different things — ask before writing.
    if (isEditMode && rule && templateChanged) {
      setScopeOpen(true)
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && expense && onUpdate) {
        await onUpdate(expense.id, expense.date, expenseUpdate())
      } else if (frequency) {
        // The server creates the rule and, when the start date has already arrived,
        // the first transaction along with it.
        await createRule(ruleInput())
      } else {
        await onSubmit({
          date,
          amount: baseAmount,
          type,
          category,
          note,
          remarks,
          baseCurrency,
          ...(isForeign && { currency, originalAmount: amount, rate: rate! }),
        })
      }
      onClose()
    } catch (err) {
      console.error(`Failed to save ${type}:`, err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyScope = async (scope: EditScope) => {
    if (!expense || !rule) return

    setIsSubmitting(true)
    try {
      if (scope === 'one') {
        await onUpdate?.(expense.id, expense.date, expenseUpdate())
      } else {
        await updateRule({
          id: rule.id,
          input: ruleInput(),
          propagate: scope,
          // "Future" opens at this occurrence, not at today — editing a payment dated
          // next month should not leave that same payment behind.
          from: expense.occurrenceDate ?? expense.date,
        })
        // The rule rewrote this row along with its siblings, but rules never carry a
        // date, so a date change is applied to this one occurrence afterwards.
        if (date !== expense.date) {
          await onUpdate?.(expense.id, expense.date, { date })
        }
      }
      setScopeOpen(false)
      onClose()
    } catch (err) {
      console.error(`Failed to save ${type}:`, err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const hasRates = Object.keys(rates).length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-100">
          Cancel
        </button>
        <span className="text-base font-semibold text-zinc-100">
          {isEditMode ? `Edit ${NOUN[type]}` : `New ${NOUN[type]}`}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!canSave || isSubmitting}
          className={`text-sm font-semibold ${accent.text} ${accent.hover} disabled:text-zinc-600 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Live in edit mode too — flipping the direction of an existing entry is just a
          field update, since the sort key doesn't encode the type. The exception is a
          generated row: direction belongs to its rule, and is edited from settings. */}
      {!rule && (
        <div className="px-4 py-3 border-b border-zinc-800">
          <TypeToggle value={type} onChange={selectType} />
        </div>
      )}

      {/* Fields — one full-width row each, click to edit */}
      <div className="flex-1 overflow-y-auto">
        {FIELDS.map((f) => {
          const isActive = f.key === activeField
          return (
            <button
              key={f.key}
              onClick={() => setActiveField(f.key)}
              className={`flex w-full items-center justify-between gap-4 px-4 py-4 border-b border-zinc-800 text-left transition-colors ${
                isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
              }`}
            >
              <span
                className={`text-sm font-medium ${isActive ? accent.text : 'text-zinc-400'}`}
              >
                {f.label}
              </span>
              <span
                className={`truncate text-base ${
                  isFilled(f.key) ? 'text-zinc-100' : 'text-zinc-600'
                }`}
              >
                {fieldSummary(f.key)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Input for the active field, pinned to the bottom */}
      <div className="border-t border-zinc-800 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Currency selector only shown when editing the amount */}
        {activeField === 'amount' && currencies.length > 1 && (
          <div className="mb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {currencies.map((code) => {
                const isBase = code === baseCurrency
                const disabled = !isBase && !hasRates
                return (
                  <button
                    key={code}
                    onClick={() => selectCurrency(code)}
                    disabled={disabled}
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
                )
              })}
            </div>
            {isForeign && (
              <p className="text-xs text-zinc-500 mt-1 px-1">
                {canConvert
                  ? `Saved as ${formatAmount(baseAmount, baseCurrency)} · ${formatRate(baseCurrency, currency, rate!)}`
                  : 'Exchange rate unavailable — connect to the internet to use this currency.'}
              </p>
            )}
            {!hasRates && !isForeign && (
              <p className="text-xs text-zinc-600 mt-1 px-1">
                Exchange rates unavailable — only {baseCurrency} can be used right now.
              </p>
            )}
          </div>
        )}

        {activeField === 'date' && <DatePicker value={date} onChange={setDate} />}
        {activeField === 'amount' && (
          <Calculator value={amount} onChange={setAmount} currency={currency} />
        )}
        {activeField === 'category' && (
          <CategoryPicker value={category} onChange={setCategory} type={type} />
        )}
        {activeField === 'note' && (
          <TextAreaInput
            value={note}
            onChange={setNote}
            label="Note (optional)"
            placeholder={type === 'income' ? 'Where did this come from?' : 'What was this expense for?'}
          />
        )}
        {activeField === 'remarks' && (
          <TextAreaInput
            value={remarks}
            onChange={setRemarks}
            label="Remarks (optional)"
            placeholder="Longer comments, context, or a description…"
            rows={5}
          />
        )}
        {activeField === 'recurring' &&
          (isEditMode ? (
            // The schedule is a property of the rule, not of any one occurrence, so it
            // is read-only here and edited from Settings › Recurring Items.
            <p className="px-1 py-2 text-xs text-zinc-500">
              {rule
                ? `Repeats ${FREQUENCY_LABEL[rule.frequency].toLowerCase()} since ${formatDate(
                    rule.startDate
                  )}. Change the schedule in Settings › Recurring Items.`
                : 'This entry is one-time. Recurring items are created from Settings › Recurring Items.'}
            </p>
          ) : (
            <>
              <FrequencyPicker value={frequency} onChange={setFrequency} type={type} />
              {frequency && (
                <p className="mt-1 px-1 text-xs text-zinc-500">
                  Repeats {FREQUENCY_LABEL[frequency].toLowerCase()} from {formatDate(date)}. Each
                  one is added automatically when it comes due.
                </p>
              )}
            </>
          ))}

        <button
          onClick={confirmField}
          disabled={(isLastField ? !canSave : !canAdvance) || isSubmitting}
          className={`mt-3 w-full py-2.5 text-sm font-semibold rounded-lg shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed ${accent.button}`}
        >
          {isSubmitting
            ? 'Saving...'
            : isLastField
            ? isEditMode
              ? `Update ${NOUN[type]}`
              : `Save ${NOUN[type]}`
            : 'Confirm'}
        </button>
      </div>

      <ChoiceDialog
        isOpen={scopeOpen}
        title={`Change this ${NOUN[type].toLowerCase()}?`}
        message={
          rule
            ? `It repeats ${FREQUENCY_LABEL[
                rule.frequency
              ].toLowerCase()}. Choose how far this change should reach.`
            : undefined
        }
        choices={[
          { key: 'one', label: 'Only this one', description: 'Leaves the schedule untouched' },
          {
            key: 'future',
            label: 'This and all future',
            description: 'Updates the schedule from this date onwards',
          },
          {
            key: 'all',
            label: 'All, past and future',
            description: 'Rewrites every entry this schedule has created',
          },
        ]}
        isBusy={isSubmitting}
        onSelect={(scope: EditScope) => applyScope(scope)}
        onCancel={() => setScopeOpen(false)}
      />
    </div>
  )
}
