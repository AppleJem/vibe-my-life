import { useRef, useState, useCallback } from 'react'
import type { Expense } from '../../types/expense'
import { displayCategory } from '../../constants/categories'
import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'

interface ExpenseItemProps {
  expense: Expense
  onDelete: (id: string, date: string) => Promise<void>
  onClick?: (expense: Expense) => void
}

export function ExpenseItem({ expense, onDelete, onClick }: ExpenseItemProps) {
  const { baseCurrency } = useCurrency()
  const [swipeX, setSwipeX] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    isDraggingRef.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return
    const diff = e.touches[0].clientX - startXRef.current
    // Only allow swiping left (negative)
    setSwipeX(Math.min(0, diff))
  }, [])

  const handleTouchEnd = useCallback(async () => {
    isDraggingRef.current = false
    if (Math.abs(swipeX) > THRESHOLD) {
      setIsDeleting(true)
      await onDelete(expense.id, expense.date)
    } else {
      setSwipeX(0)
    }
  }, [swipeX, expense, onDelete])

  const handleDeleteClick = async () => {
    setIsDeleting(true)
    await onDelete(expense.id, expense.date)
  }

  const handleClick = () => {
    // Only trigger click if not swiping
    if (Math.abs(swipeX) < 5 && onClick) {
      onClick(expense)
    }
  }

  if (isDeleting) return null

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 rounded-xl">
        <span className="text-white text-sm font-medium">Delete</span>
      </div>

      {/* Swipeable content */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-between p-4 bg-zinc-900 rounded-xl transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
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
            <span className="text-zinc-100 font-semibold">
              {formatAmount(expense.amount, expense.baseCurrency ?? baseCurrency)}
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
              handleDeleteClick()
            }}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1"
            title="Delete expense"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
