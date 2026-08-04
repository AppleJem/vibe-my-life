import { useState, useRef } from 'react'
import { useSpring, animated, type AnimatedProps } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { getCategoryByKey } from '../../constants/categories'
import type { Expense } from '../../types/expense'
import type { HTMLAttributes } from 'react'

const AnimatedDiv = animated.div as React.ComponentType<AnimatedProps<HTMLAttributes<HTMLDivElement>>>

interface ExpenseItemProps {
  expense: Expense
  onDelete: (id: string, date: string) => void
}

export function ExpenseItem({ expense, onDelete }: ExpenseItemProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const category = getCategoryByKey(expense.category)
  const confirmRef = useRef<HTMLDivElement>(null)

  const [{ x }, api] = useSpring(() => ({ x: 0 }))

  const bind = useDrag(
    ({ down, movement: [mx], cancel }) => {
      // Only allow left swipe
      const newX = Math.min(0, mx)
      
      if (newX < -120) {
        cancel()
        setShowConfirm(true)
        api.start({ x: 0 })
        return
      }

      api.start({ x: down ? newX : 0, immediate: down })
    },
    { axis: 'x' }
  )

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(expense.id, expense.date)
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl mb-3">
        {/* Delete background */}
        <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4">
          <span className="text-white font-medium">Delete</span>
        </div>

        {/* Swipeable content */}
        <AnimatedDiv
          {...bind()}
          style={{ x, touchAction: 'pan-y' } as any}
          className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 cursor-grab active:cursor-grabbing"
        >
          <div className="text-3xl">{category?.emoji ?? '📦'}</div>
          
          <div className="flex-1 min-w-0">
            <p className="text-zinc-100 font-medium truncate">
              {expense.note || (category?.label ?? 'Expense')}
            </p>
            <p className="text-sm text-zinc-400">
              {new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="text-right">
            <p className="text-lg font-semibold text-zinc-100">
              ${expense.amount.toFixed(2)}
            </p>
          </div>
        </AnimatedDiv>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            ref={confirmRef}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">
              Delete expense?
            </h3>
            <p className="text-zinc-400 mb-6">
              {expense.note || category?.label} — ${expense.amount.toFixed(2)}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-zinc-800 text-zinc-100 rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
