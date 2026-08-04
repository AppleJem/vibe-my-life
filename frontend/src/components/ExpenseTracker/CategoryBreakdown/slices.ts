import { assignSliceColors } from '../../../constants/chartColors'
import { categoryTotals, type CategoryTotal } from '../../../utils/categoryTotals'
import { formatAmount } from '../../../utils/currency'
import type { Expense } from '../../../types/expense'

export interface CategorySlice extends CategoryTotal {
  color: string
  /** 0–100, share of the month's total. */
  percent: number
  /** Pre-formatted amount, so the donut and the list can't disagree. */
  label: string
}

/**
 * Ranked slices for the donut and the list beneath it. Colours are assigned in
 * spend order, which means the ring order the palette was validated against is
 * the order actually rendered.
 */
export function buildSlices(expenses: Expense[], baseCurrency: string): CategorySlice[] {
  const totals = categoryTotals(expenses)
  const colors = assignSliceColors(totals.length)
  const total = totals.reduce((sum, t) => sum + t.amount, 0)

  return totals.map((entry, i) => ({
    ...entry,
    color: colors[i],
    percent: total > 0 ? (entry.amount / total) * 100 : 0,
    label: formatAmount(entry.amount, baseCurrency),
  }))
}
