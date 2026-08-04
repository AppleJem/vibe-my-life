/**
 * Money out vs money in. Rows written before income existed carry no `type` at all,
 * so **absent always reads as `'expense'`** — never compare `type` directly, go
 * through the `?? 'expense'` fallback.
 */
export type TransactionType = 'expense' | 'income'

export interface Expense {
  id: string
  date: string          // YYYY-MM-DD
  /**
   * Always in baseCurrency, and always a positive magnitude — the sign is
   * presentation, derived from `type`. Nothing here is ever stored negative.
   */
  amount: number
  /** Absent on rows written before income existed; treat as 'expense'. */
  type?: TransactionType
  /** Belongs to the category list matching `type` — the two lists are independent. */
  category: string
  note: string
  /** Free-form long-form comment. Absent on rows written before the field existed. */
  remarks?: string
  createdAt: string     // ISO string

  // Multi-currency. `baseCurrency` is a snapshot of the user's base at save time —
  // changing the base later does not rewrite past expenses. The three foreign fields
  // are absent when the expense was entered in the base currency, so the presence of
  // `currency` is the signal for "this was a foreign-currency spend".
  baseCurrency?: string
  currency?: string
  originalAmount?: number   // as typed, in `currency`
  rate?: number             // units of `currency` per 1 base, at save time
}

export interface CreateExpenseInput {
  date: string
  amount: number
  type?: TransactionType
  category: string
  note?: string
  remarks?: string
  baseCurrency?: string
  currency?: string
  originalAmount?: number
  rate?: number
}

/**
 * A create that may carry its own `createdAt`. Only the importer uses this — a
 * backup row's original timestamp is the only record of its time-of-day, which the
 * source file stores but hides behind a date-only cell format.
 */
export interface ImportExpenseInput extends CreateExpenseInput {
  createdAt?: string
}

export interface UpdateExpenseInput {
  date?: string
  amount?: number
  // Flipping the type is a plain field update — the sort key doesn't encode it.
  type?: TransactionType
  category?: string
  note?: string
  remarks?: string
  baseCurrency?: string
  // null clears the field — used when a foreign expense is edited back to the base currency
  currency?: string | null
  originalAmount?: number | null
  rate?: number | null
}
