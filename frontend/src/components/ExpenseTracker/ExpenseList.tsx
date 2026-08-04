import { ExpenseItem } from './ExpenseItem'
import type { Expense } from '../../types/expense'

interface ExpenseListProps {
  expenses: Expense[]
  loading: boolean
  onDelete: (id: string, date: string) => void
}

export function ExpenseList({ expenses, loading, onDelete }: ExpenseListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl" />
              <div className="flex-1">
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded w-1/3" />
              </div>
              <div className="h-6 bg-zinc-800 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">💸</div>
        <p className="text-zinc-400 text-lg">No expenses this month</p>
        <p className="text-zinc-500 text-sm mt-1">
          Tap + to add your first expense
        </p>
      </div>
    )
  }

  return (
    <div>
      {expenses.map((expense) => (
        <ExpenseItem
          key={expense.id}
          expense={expense}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
