import { useState } from 'react'
import type { Expense } from '../../types/expense'
import { displayCategory } from '../../constants/categories'
import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'
import { isIncome } from '../../utils/transaction'
import { ConfirmDialog } from '../ConfirmDialog'

interface ExpenseItemProps {
  expense: Expense
  onDelete: (id: string, date: string) => Promise<void>
  onClick?: (expense: Expense) => void
}

export function ExpenseItem({ expense, onDelete, onClick }: ExpenseItemProps) {
  const { baseCurrency } = useCurrency()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(expense.id, expense.date)
    } finally {
      setIsDeleting(false)
      setConfirmOpen(false)
    }
  }

  // Amounts are stored as magnitudes for both types, so the sign is added here.
  const income = isIncome(expense)
  const amountLabel = `${income ? '+' : '−'}${formatAmount(
    expense.amount,
    expense.baseCurrency ?? baseCurrency
  )}`

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="relative flex items-center justify-between p-4 bg-zinc-900 rounded-xl"
        onClick={() => onClick?.(expense)}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-zinc-100 font-medium">{displayCategory(expense.category)}</p>
            {expense.note && (
              <p className="text-zinc-500 text-sm">{expense.note}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Base-currency value leads; the amount as actually spent sits underneath.
              Legacy rows have no `currency` and stay single-line. */}
          <div className="text-right">
            <span className={`font-semibold ${income ? 'text-lime-400' : 'text-zinc-100'}`}>
              {amountLabel}
            </span>
            {expense.currency && expense.originalAmount != null && (
              <p className="text-zinc-500 text-xs">
                {formatAmount(expense.originalAmount, expense.currency)}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setConfirmOpen(true)
            }}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            title={income ? 'Delete income' : 'Delete expense'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={income ? 'Delete this income?' : 'Delete this expense?'}
        message={`${displayCategory(expense.category)} · ${amountLabel}`}
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
