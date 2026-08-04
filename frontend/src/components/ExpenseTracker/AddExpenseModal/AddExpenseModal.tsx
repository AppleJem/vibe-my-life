import { useEffect, useState } from 'react'
import { DatePicker } from './DatePicker'
import { Calculator } from './Calculator'
import { CategoryPicker } from './CategoryPicker'
import { TextAreaInput } from './TextAreaInput'
import { TypeToggle } from '../../TypeToggle'
import { displayCategory } from '../../../constants/categories'
import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount, formatRate, toBase } from '../../../utils/currency'
import { typeOf } from '../../../utils/transaction'
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  Expense,
  TransactionType,
} from '../../../types/expense'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
  expense?: Expense | null
  onUpdate?: (id: string, date: string, updates: UpdateExpenseInput) => Promise<void>
}

type Field = 'date' | 'amount' | 'category' | 'note' | 'remarks'

const FIELDS: { key: Field; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
  { key: 'remarks', label: 'Remarks' },
]

/**
 * Fields that may be left blank. Confirm has to stay enabled on these — before
 * remarks existed, note was last and fell through to the save path, so nothing
 * ever had to skip past an empty optional field.
 */
const OPTIONAL_FIELDS: Field[] = ['note', 'remarks']

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

  const [activeField, setActiveField] = useState<Field>('date')
  const [type, setType] = useState<TransactionType>('expense')
  const [date, setDate] = useState(todayStr)
  // The amount as typed, in `currency` — not necessarily the base currency.
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState(baseCurrency)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    setActiveField('date')
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

  const handleSubmit = async () => {
    if (!canSave) return
    setIsSubmitting(true)
    try {
      if (isEditMode && expense && onUpdate) {
        await onUpdate(expense.id, expense.date, {
          date,
          amount: baseAmount,
          type,
          category,
          note,
          remarks,
          baseCurrency,
          // Explicit nulls clear the stored foreign fields when an expense is
          // edited back to the base currency.
          currency: isForeign ? currency : null,
          originalAmount: isForeign ? amount : null,
          rate: isForeign ? rate! : null,
        })
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
          field update, since the sort key doesn't encode the type. */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <TypeToggle value={type} onChange={selectType} />
      </div>

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
    </div>
  )
}
