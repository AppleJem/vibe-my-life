import type { Expense, TransactionType } from '../types/expense'

/**
 * The one place that knows an absent `type` means expense. Every row written before
 * income shipped lacks the attribute, so nothing should compare `e.type` directly.
 */
export function typeOf(expense: Expense): TransactionType {
  return expense.type ?? 'expense'
}

export function isIncome(expense: Expense): boolean {
  return typeOf(expense) === 'income'
}

/**
 * Positive for income, negative for expense. Only ever for net figures — charts sum
 * magnitudes within one type, and mixing signs into a donut's denominator breaks the
 * percentages.
 */
export function signedAmount(expense: Expense): number {
  return isIncome(expense) ? expense.amount : -expense.amount
}

/** Sum of magnitudes. Feed it one type's rows. */
export function sumOf(expenses: Expense[]): number {
  return expenses.reduce((total, e) => total + e.amount, 0)
}

export function splitByType(expenses: Expense[]): {
  expenses: Expense[]
  income: Expense[]
} {
  const out: { expenses: Expense[]; income: Expense[] } = { expenses: [], income: [] }
  for (const e of expenses) {
    if (isIncome(e)) out.income.push(e)
    else out.expenses.push(e)
  }
  return out
}

/** Rows of one type only, preserving order. */
export function ofType(expenses: Expense[], type: TransactionType): Expense[] {
  return expenses.filter((e) => typeOf(e) === type)
}

/** Epoch millis for ordering. Anything unparseable sinks to the bottom rather than
 *  making the comparator inconsistent, which would scramble the whole day. */
function createdAtMs(expense: Expense): number {
  const parsed = Date.parse(expense.createdAt ?? '')
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Newest first. A day's rows arrive in DynamoDB sort-key order — `EXPENSE#date#uuid` —
 * so within one date they come back ordered by a random uuid. `createdAt` is the real
 * entry time, and imported rows carry the time-of-day from the source file, so this
 * orders those by when they actually happened too.
 *
 * The id tie-break keeps rows stable when two share a timestamp, which is routine for
 * an import where the source had no time-of-day and every row collapsed to midnight.
 */
export function byNewestFirst(a: Expense, b: Expense): number {
  return createdAtMs(b) - createdAtMs(a) || a.id.localeCompare(b.id)
}
