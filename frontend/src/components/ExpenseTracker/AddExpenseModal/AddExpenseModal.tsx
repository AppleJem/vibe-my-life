import { useEffect, useState } from 'react'
import { DatePicker } from './DatePicker'
import { Calculator } from './Calculator'
import { CategoryPicker } from './CategoryPicker'
import { NoteInput } from './NoteInput'
import { displayCategory } from '../../../constants/categories'
import type { CreateExpenseInput, UpdateExpenseInput, Expense } from '../../../types/expense'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
  expense?: Expense | null
  onUpdate?: (id: string, date: string, updates: UpdateExpenseInput) => Promise<void>
}

type Field = 'date' | 'amount' | 'category' | 'note'

const FIELDS: { key: Field; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
]

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

  const [activeField, setActiveField] = useState<Field>('date')
  const [date, setDate] = useState(todayStr)
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load the expense being edited (or a blank form) each time the modal opens
  useEffect(() => {
    if (!isOpen) return
    setDate(expense?.date ?? todayStr)
    setAmount(expense?.amount ?? 0)
    setCategory(expense?.category ?? '')
    setNote(expense?.note ?? '')
    setActiveField('date')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, expense])

  const canSave = !!date && amount > 0 && !!category

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
      case 'amount':
        return amount > 0 ? `¥${amount.toFixed(2)}` : '—'
      case 'category':
        return category ? displayCategory(category) : '—'
      case 'note':
        return note.trim() || '—'
    }
  }

  const isFilled = (key: Field) => {
    switch (key) {
      case 'date':
        return !!date
      case 'amount':
        return amount > 0
      case 'category':
        return !!category
      case 'note':
        return !!note.trim()
    }
  }

  const activeIndex = FIELDS.findIndex((f) => f.key === activeField)
  const isLastField = activeIndex === FIELDS.length - 1

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
        await onUpdate(expense.id, expense.date, { date, amount, category, note })
      } else {
        await onSubmit({ date, amount, category, note })
      }
      onClose()
    } catch (err) {
      console.error('Failed to save expense:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-100">
          Cancel
        </button>
        <span className="text-base font-semibold text-zinc-100">
          {isEditMode ? 'Edit Expense' : 'New Expense'}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!canSave || isSubmitting}
          className="text-sm font-semibold text-pink-500 hover:text-pink-400 disabled:text-zinc-600 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
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
                className={`text-sm font-medium ${
                  isActive ? 'text-pink-500' : 'text-zinc-400'
                }`}
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
        {activeField === 'date' && <DatePicker value={date} onChange={setDate} />}
        {activeField === 'amount' && <Calculator value={amount} onChange={setAmount} />}
        {activeField === 'category' && (
          <CategoryPicker value={category} onChange={setCategory} />
        )}
        {activeField === 'note' && <NoteInput value={note} onChange={setNote} />}

        <button
          onClick={confirmField}
          disabled={(isLastField ? !canSave : !isFilled(activeField)) || isSubmitting}
          className="mt-3 w-full py-2.5 bg-pink-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? 'Saving...'
            : isLastField
            ? isEditMode
              ? 'Update Expense'
              : 'Save Expense'
            : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
