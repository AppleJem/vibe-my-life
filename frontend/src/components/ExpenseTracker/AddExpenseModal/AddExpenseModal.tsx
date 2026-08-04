import { useState } from 'react'
import { DatePicker } from './DatePicker'
import { Calculator } from './Calculator'
import { CategoryPicker } from './CategoryPicker'
import { NoteInput } from './NoteInput'
import type { CreateExpenseInput } from '../../../types/expense'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateExpenseInput) => Promise<void>
}

type Step = 'date' | 'amount' | 'category' | 'note'

const STEPS: { key: Step; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
]

export function AddExpenseModal({ isOpen, onClose, onSubmit }: AddExpenseModalProps) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

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
      await onSubmit({ date, amount, category, note })
      resetForm()
      onClose()
    } catch (err) {
      console.error('Failed to create expense:', err)
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
  }

  const handleClose = () => {
    resetForm()
    onClose()
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
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= currentStepIndex ? 'bg-rose-400' : 'bg-zinc-700'
                }`}
              />
            ))}
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
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            {STEPS[currentStepIndex].label}
          </h2>

          {step === 'date' && <DatePicker value={date} onChange={setDate} />}
          {step === 'amount' && <Calculator value={amount} onChange={setAmount} />}
          {step === 'category' && <CategoryPicker value={category} onChange={setCategory} />}
          {step === 'note' && <NoteInput value={note} onChange={setNote} />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={goNext}
            disabled={!canProceed() || isSubmitting}
            className="w-full py-3 bg-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Saving...'
              : isLastStep
              ? 'Save Expense'
              : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
