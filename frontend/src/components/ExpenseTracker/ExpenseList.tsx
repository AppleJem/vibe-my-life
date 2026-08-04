import { ExpenseItem } from './ExpenseItem'
import type { Expense } from '../../types/expense'

interface ExpenseListProps {
  expenses: Expense[]
  loading: boolean
  onDelete: (id: string, date: string) => Promise<void>
  onExpenseClick?: (expense: Expense) => void
}

export function ExpenseList({ expenses, loading, onDelete, onExpenseClick }: ExpenseListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-zinc-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 text-sm">No expenses this month</p>
        <p className="text-zinc-600 text-xs mt-1">
          Tap + to add your first expense
        </p>
      </div>
    )
  }

  // Group expenses by date
  const grouped = expenses.reduce((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = []
    acc[expense.date].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const dayExpenses = grouped[date]
        const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0)

        return (
          <div key={date}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-zinc-400 text-xs font-medium">{date}</p>
              <p className="text-zinc-500 text-xs">¥{dayTotal.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              {dayExpenses.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  onDelete={onDelete}
                  onClick={onExpenseClick}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
