import { ExpenseItem } from './ExpenseItem'
import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'
import { signedAmount, byNewestFirst } from '../../utils/transaction'
import type { Expense } from '../../types/expense'

interface ExpenseListProps {
  expenses: Expense[]
  loading: boolean
  onDelete: (id: string, date: string) => Promise<void>
  onExpenseClick?: (expense: Expense) => void
  /** `'date'` groups by day (default), `'amount'` renders a flat list largest-first. */
  sort?: 'date' | 'amount'
}

export function ExpenseList({ expenses, loading, onDelete, onExpenseClick, sort = 'date' }: ExpenseListProps) {
  const { baseCurrency } = useCurrency()

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
        <p className="text-zinc-500 text-sm">Nothing this month</p>
        <p className="text-zinc-600 text-xs mt-1">
          Tap + to add an expense or income
        </p>
      </div>
    )
  }

  if (sort === 'amount') {
    // Flat list, largest expense first.
    const sorted = [...expenses].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
    return (
      <div className="space-y-2">
        {sorted.map((expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            onDelete={onDelete}
            onClick={onExpenseClick}
          />
        ))}
      </div>
    )
  }

  // Group expenses by date (default)
  const grouped = expenses.reduce((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = []
    acc[expense.date].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        // Newest first within the day; the query only guarantees the date grouping.
        const dayExpenses = [...grouped[date]].sort(byNewestFirst)
        // Net for the day: a day with a 4,000 salary and a 12.50 lunch reads +3,987.50,
        // not 4,012.50. `signedAmount` is what keeps the two directions apart.
        const dayTotal = dayExpenses.reduce((sum, e) => sum + signedAmount(e), 0)

        return (
          <div key={date}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-zinc-400 text-xs font-medium">{date}</p>
              <p className={`text-xs ${dayTotal > 0 ? 'text-lime-400/70' : 'text-zinc-500'}`}>
                {dayTotal > 0 && '+'}
                {formatAmount(dayTotal, baseCurrency)}
              </p>
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
