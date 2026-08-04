import { useState } from 'react'
import { DatePicker } from './DatePicker'
import { Calculator } from './Calculator'
import { CategoryPicker } from './CategoryPicker'
import { NoteInput } from './NoteInput'
import type { CreateExpenseInput, UpdateExpenseInput, Expense } from '../../../types/expense'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
  expense?: Expense | null
  onUpdate?: (id: string, date: string, updates: UpdateExpenseInput) => Promise<void>
}

type Step = 'date' | 'amount' | 'category' | 'note'

const STEPS: { key: Step; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
]

const CATEGORY_LABELS: Record<string, string> = {
  food: '🍔 Food',
  transport: '🚌 Transport',
  shopping: '🛍️ Shopping',
  entertainment: '🎬 Entertainment',
  bills: '📄 Bills',
  health: '💊 Health',
  other: '📦 Other',
}

export function AddExpenseModal({ isOpen, onClose, onSubmit, expense, onUpdate }: AddExpenseModalProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const isEditMode = !!expense
  const [isEditing, setIsEditing] = useState(false)
  const [step, setStep] = useState<Step>('date')
  const [date, setDate] = useState(todayStr)
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === STEPS.length - 1

  const canProceed = () => {
    switch (step) {
      case 'date':
        return !!date
      case 'amount':
        return amount > 0
      case 'category':
        return !!category
      case 'note':
        return true // note is optional
      default:
        return false
    }
  }

  const goNext = () => {
    if (!canProceed()) return
    if (isLastStep) {
      handleSubmit()
      return
    }
    setStep(STEPS[currentStepIndex + 1].key)
  }

  const goBack = () => {
    if (!isFirstStep) {
      setStep(STEPS[currentStepIndex - 1].key)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (isEditMode && expense && onUpdate) {
        await onUpdate(expense.id, expense.date, { date, amount, category, note })
      } else {
        await onSubmit({ date, amount, category, note })
      }
      resetForm()
      onClose()
    } catch (err) {
      console.error('Failed to save expense:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setDate(todayStr)
    setAmount(0)
    setCategory('')
    setNote('')
    setStep('date')
    setIsEditing(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleFieldClick = (field: Step) => {
    if (!isEditing) {
      setIsEditing(true)
    }
    setStep(field)
  }

  // Initialize form with expense data when opening in edit mode
  const initFromExpense = () => {
    if (expense) {
      setDate(expense.date)
      setAmount(expense.amount)
      setCategory(expense.category)
      setNote(expense.note || '')
      setStep('date')
      setIsEditing(false)
    }
  }

  // Call initFromExpense when modal opens with an expense
  if (isOpen && isEditMode && !isEditing && date !== expense?.date && amount !== expense?.amount) {
    initFromExpense()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 rounded-t-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <button
            onClick={isFirstStep ? handleClose : goBack}
            className="text-zinc-400 hover:text-zinc-100"
          >
            {isFirstStep ? 'Cancel' : 'Back'}
          </button>
          <div className="flex gap-2">
            {isEditMode && !isEditing ? (
              <span className="text-sm font-medium text-zinc-300">
                {expense?.category ? CATEGORY_LABELS[expense.category] || expense.category : 'Expense'}
              </span>
            ) : (
              STEPS.map((s, i) => (
                <div
                  key={s.key}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    i <= currentStepIndex ? 'bg-pink-500' : 'bg-zinc-700'
                  }`}
                />
              ))
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isEditMode && !isEditing ? (
            /* View Mode - Summary cards */
            <div className="space-y-3">
              <button
                onClick={() => handleFieldClick('date')}
                className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <span className="text-zinc-400 text-sm">Date</span>
                <span className="text-zinc-100 font-medium">{expense?.date}</span>
              </button>
              <button
                onClick={() => handleFieldClick('amount')}
                className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <span className="text-zinc-400 text-sm">Amount</span>
                <span className="text-2xl font-bold text-pink-500">¥{expense?.amount.toFixed(2)}</span>
              </button>
              <button
                onClick={() => handleFieldClick('category')}
                className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <span className="text-zinc-400 text-sm">Category</span>
                <span className="text-zinc-100 font-medium">
                  {expense?.category ? CATEGORY_LABELS[expense.category] || expense.category : '—'}
                </span>
              </button>
              <button
                onClick={() => handleFieldClick('note')}
                className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                <span className="text-zinc-400 text-sm">Note</span>
                <span className="text-zinc-100 font-medium truncate max-w-[60%] text-right">
                  {expense?.note || '—'}
                </span>
              </button>
            </div>
          ) : (
            /* Edit Mode - Input fields */
            <>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                {STEPS[currentStepIndex].label}
              </h2>

              {step === 'date' && <DatePicker value={date} onChange={setDate} />}
              {step === 'amount' && <Calculator value={amount} onChange={setAmount} />}
              {step === 'category' && <CategoryPicker value={category} onChange={setCategory} />}
              {step === 'note' && <NoteInput value={note} onChange={setNote} />}
            </>
          )}
        </div>

        {/* Footer */}
        {(!isEditMode || isEditing) && (
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={goNext}
              disabled={!canProceed() || isSubmitting}
              className="w-full py-3 bg-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Saving...'
                : isLastStep
                ? isEditMode
                  ? 'Update Expense'
                  : 'Save Expense'
                : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
