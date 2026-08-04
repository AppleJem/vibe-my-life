import type { TransactionType } from '../expense/expense.types.d.js'

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/**
 * A schedule that materialises ordinary transactions. Rules live in the `recurring`
 * attribute of the user's META item, not as rows of their own — there are a handful of
 * them, they're read on every app entry, and keeping them beside categories means one
 * `GetCommand` serves the whole of settings.
 *
 * Everything below `frequency` is the template stamped onto each generated row, and
 * mirrors `Expense` field for field.
 */
export interface RecurringRule {
  id: string
  type: TransactionType
  frequency: RecurringFrequency
  /**
   * YYYY-MM-DD of the first occurrence, and the anchor the rest are counted from — the
   * weekday for `weekly`, the day-of-month for `monthly`, the month/day for `yearly`.
   */
  startDate: string
  /**
   * YYYY-MM-DD of the newest occurrence already written. Absent means the rule has never
   * fired. This watermark — not a scan of the expense rows — is what decides what
   * catch-up generates, which is why deleting a generated row leaves it deleted.
   */
  lastRunDate?: string

  /** Positive magnitude in `baseCurrency`, exactly like `Expense.amount`. */
  amount: number
  category: string
  note: string
  remarks: string

  // Foreign-currency snapshot, repeated verbatim on every generated row. The server has
  // no FX access, so a rule is priced at the rate it was created with until it's edited.
  baseCurrency?: string
  currency?: string
  originalAmount?: number
  rate?: number

  createdAt: string
  updatedAt: string
}

/** The rule fields a client may write. The rest are server-owned bookkeeping. */
export interface RecurringRuleInput {
  type: TransactionType
  frequency: RecurringFrequency
  startDate: string
  amount: number
  category: string
  note?: string
  remarks?: string
  baseCurrency?: string
  currency?: string | null
  originalAmount?: number | null
  rate?: number | null
}

/**
 * How far an edit to a rule reaches into the rows it has already generated.
 * - `none`  — rule only; existing rows are left alone.
 * - `future` — rows whose `occurrenceDate` is on or after `from`.
 * - `all`    — every row of the rule.
 */
export type PropagateScope = 'none' | 'future' | 'all'
