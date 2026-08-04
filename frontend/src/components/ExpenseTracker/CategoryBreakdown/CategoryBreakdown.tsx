import { useMemo, useState } from 'react'
import { CategoryDonut } from './CategoryDonut'
import { CategoryLegendList } from './CategoryLegendList'
import { buildSlices } from './slices'
import { ExpenseList } from '../ExpenseList'
import { useCurrency } from '../../../contexts/MetadataContext'
import type { Expense } from '../../../types/expense'

interface CategoryBreakdownProps {
  expenses: Expense[]
  loading: boolean
  onDelete: (id: string, date: string) => Promise<void>
  onExpenseClick?: (expense: Expense) => void
}

export function CategoryBreakdown({
  expenses,
  loading,
  onDelete,
  onExpenseClick,
}: CategoryBreakdownProps) {
  const { baseCurrency } = useCurrency()
  const [selected, setSelected] = useState<string | null>(null)

  const slices = useMemo(() => buildSlices(expenses, baseCurrency), [expenses, baseCurrency])
  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses])

  // A month can lose a category after an edit, a delete, or a month change. Deriving
  // `active` by lookup means a stale selection simply falls back to the full list
  // instead of showing an empty drill-in.
  const active = selected ? slices.find((s) => s.parent === selected) ?? null : null

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-64 bg-zinc-800 rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (slices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 text-sm">No expenses this month</p>
        <p className="text-zinc-600 text-xs mt-1">Tap + to add your first expense</p>
      </div>
    )
  }

  return (
    // Clicking anywhere that isn't a slice or a row clears the selection.
    <div onClick={() => setSelected(null)}>
      <CategoryDonut
        slices={slices}
        total={total}
        selected={active?.parent ?? null}
        onSelect={(parent) => setSelected((prev) => (prev === parent ? null : parent))}
      />

      <div className="mt-6">
        {active ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: active.color }}
                />
                <span className="text-zinc-100 font-medium truncate">{active.parent}</span>
                <span className="text-zinc-500 text-sm tabular-nums shrink-0">
                  {active.label}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(null)
                }}
                className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 shrink-0"
                aria-label="Clear category filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Reuses the list view's renderer, so date grouping, edit-on-tap and
                delete-with-confirm behave the same in both views. */}
            <div onClick={(e) => e.stopPropagation()}>
              <ExpenseList
                expenses={active.expenses}
                loading={false}
                onDelete={onDelete}
                onExpenseClick={onExpenseClick}
              />
            </div>
          </>
        ) : (
          <CategoryLegendList slices={slices} onSelect={setSelected} />
        )}
      </div>
    </div>
  )
}
