import type { RecurringRule } from '../recurring/recurring.types.d.js'

export interface Category {
  name: string
  subcategories: string[]
}

export interface ExpenseMetadata {
  /** Expense categories. Independent of `incomeCategories` — names may overlap. */
  categories: Category[]
  incomeCategories: Category[]
  /** ISO code every expense amount is normalised to. */
  baseCurrency: string
  /** Additional currencies the user can spend in. Never includes baseCurrency. */
  currencies: string[]
  /**
   * Subscription / salary schedules. Unlike `incomeCategories`, absent and `[]` mean the
   * same thing — there is nothing to seed, so a plain `?? []` read default is correct.
   */
  recurring: RecurringRule[]
  updatedAt: string
}

export interface CategoryRename {
  from: string
  to: string
}

/** Only the provided keys are written; the rest of the META item is left alone. */
export interface MetadataPatch {
  categories?: Category[]
  incomeCategories?: Category[]
  baseCurrency?: string
  currencies?: string[]
  recurring?: RecurringRule[]
}
