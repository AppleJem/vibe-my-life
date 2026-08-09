/**
 * How a month's spending sits against the monthly budget from settings.
 *
 * Only money out counts — income is not a budget refund, so a big salary row must not
 * quietly buy back headroom. Callers pass the expense-side total (`sumOf(split.expenses)`),
 * never the net.
 */
export interface BudgetStatus {
  budget: number
  spent: number
  /** `budget - spent`. Negative once the budget is blown; that's the overspend. */
  remaining: number
  /** `spent / budget`, unclamped — deliberately allowed past 1 so the label can say 130%. */
  ratio: number
  /** `ratio` as a 0–100 percentage, clamped, for the bar's width. */
  percent: number
  level: BudgetLevel
}

export type BudgetLevel = 'ok' | 'warning' | 'over'

const WARNING_RATIO = 0.75

export function budgetStatus(spent: number, budget: number): BudgetStatus {
  const ratio = budget > 0 ? spent / budget : 0

  return {
    budget,
    spent,
    remaining: budget - spent,
    ratio,
    percent: Math.min(Math.max(ratio, 0), 1) * 100,
    level: ratio >= 1 ? 'over' : ratio >= WARNING_RATIO ? 'warning' : 'ok',
  }
}

/**
 * How far through the month "now" is, as a 0–1 fraction, or `null` when `yearMonth`
 * isn't the month `now` falls in. A finished month is trivially 100% elapsed and a
 * future one 0%, which says nothing — the marker only earns its place on the month
 * still in progress, where "spent 60% with 40% of the month gone" is the whole point.
 *
 * Counts the current day as spent, so the first of a 31-day month reads 1/31 rather
 * than zero — a day's spending has already had a chance to happen.
 */
export function monthElapsedFraction(yearMonth: string, now: Date = new Date()): number | null {
  const [year, month] = yearMonth.split('-').map(Number)
  if (year !== now.getFullYear() || month !== now.getMonth() + 1) return null

  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(year, month, 0).getDate()
  return now.getDate() / daysInMonth
}
