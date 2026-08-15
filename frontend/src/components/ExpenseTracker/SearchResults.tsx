import { ExpenseItem } from './ExpenseItem'
import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'
import { signedAmount } from '../../utils/transaction'
import type { Expense } from '../../types/expense'

interface SearchResultsProps {
  expenses: Expense[]
  loading: boolean
  loadedCount: number
  totalCount: number
  query: string
  onDelete: (id: string, date: string) => Promise<void>
  onExpenseClick?: (expense: Expense) => void
}

export function SearchResults({
  expenses,
  loading,
  loadedCount,
  totalCount,
  query,
  onDelete,
  onExpenseClick,
}: SearchResultsProps) {
  const { baseCurrency } = useCurrency()

  // Show loading skeleton only on initial fetch
  if (loading && expenses.length === 0) {
    return (
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // No query yet — show prompt
  if (!query.trim()) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 text-sm">Type to search expenses</p>
        <p className="text-zinc-600 text-xs mt-1">
          Search by note or remarks
        </p>
      </div>
    )
  }

  // Query entered but no results
  if (expenses.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 text-sm">No results found</p>
        <p className="text-zinc-600 text-xs mt-1">
          Try a different search term or expand the date range
        </p>
      </div>
    )
  }

  // Group expenses by date (same as ExpenseList)
  const grouped = expenses.reduce((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = []
    acc[expense.date].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6 pt-4">
      {/* Progress indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <div className="h-3 w-3 rounded-full border-2 border-zinc-600 border-t-pink-500 animate-spin" />
          <span>
            Loading months... {loadedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Result count */}
      <p className="text-zinc-500 text-xs">
        {expenses.length} result{expenses.length !== 1 ? 's' : ''} found
      </p>

      {sortedDates.map((date) => {
        const dayExpenses = grouped[date]
        const dayTotal = dayExpenses.reduce((sum, e) => sum + signedAmount(e), 0)

        return (
          <div key={date}>
            <div className="flex justify-between items-center mb-2">
              <p className="text-zinc-400 text-xs font-medium">{date}</p>
              <p
                className={`text-xs ${dayTotal > 0 ? 'text-lime-400/70' : 'text-zinc-500'}`}
              >
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
