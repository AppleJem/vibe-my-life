/**
 * Money out vs money in. Rows written before income existed carry no `type`, so
 * **absent always reads as `'expense'`** — go through `typeOf()` in
 * `utils/transaction.ts` rather than comparing `type` directly.
 */
export type TransactionType = 'expense' | 'income'

export interface Expense {
  id: string
  date: string          // YYYY-MM-DD
  /**
   * Always in baseCurrency, and always a positive magnitude — the sign is
   * presentation, derived from `type`. Nothing is ever stored negative.
   */
  amount: number
  /** Absent on rows written before income existed; treat as 'expense'. */
  type?: TransactionType
  /** Belongs to the category list matching `type` — the two lists are independent. */
  category: string
  note: string
  /** Free-form long-form comment. Absent on rows saved before the field existed. */
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

  // Recurring. Present ⇒ generated from a rule in metadata; absent ⇒ hand-entered.
  // `occurrenceDate` is the date the schedule asked for and never moves, while `date`
  // can be dragged elsewhere by an edit — that's what keeps "this and all future"
  // meaningful after someone shifts one month's payment by a few days.
  recurringId?: string
  occurrenceDate?: string   // YYYY-MM-DD
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

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/**
 * A schedule stored in metadata that materialises ordinary transactions. Everything
 * from `amount` down is the template stamped onto each generated row.
 */
export interface RecurringRule {
  id: string
  type: TransactionType
  frequency: RecurringFrequency
  /** YYYY-MM-DD of the first occurrence, and the anchor the rest are counted from. */
  startDate: string
  /** YYYY-MM-DD of the newest occurrence already written. Absent = never fired. */
  lastRunDate?: string
  amount: number
  category: string
  note: string
  remarks: string
  baseCurrency?: string
  currency?: string
  originalAmount?: number
  rate?: number
  createdAt: string
  updatedAt: string
}

/** The rule fields a client may write; the rest is server-owned bookkeeping. */
export interface RecurringRuleInput {
  type: TransactionType
  frequency: RecurringFrequency
  startDate: string
  amount: number
  category: string
  note: string
  remarks: string
  baseCurrency?: string
  // null clears the field, exactly as on UpdateExpenseInput.
  currency?: string | null
  originalAmount?: number | null
  rate?: number | null
}

/** How far an edit reaches into the rows a rule has already generated. */
export type PropagateScope = 'none' | 'future' | 'all'
