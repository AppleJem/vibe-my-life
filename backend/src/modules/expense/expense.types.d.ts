export interface Expense {
  id: string
  date: string          // YYYY-MM-DD
  amount: number        // always in baseCurrency
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
  category?: string
  note?: string
  remarks?: string
  baseCurrency?: string
  // null clears the field — used when a foreign expense is edited back to the base currency
  currency?: string | null
  originalAmount?: number | null
  rate?: number | null
}
