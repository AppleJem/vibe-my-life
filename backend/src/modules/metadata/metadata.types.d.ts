export interface Category {
  name: string
  subcategories: string[]
}

export interface ExpenseMetadata {
  categories: Category[]
  /** ISO code every expense amount is normalised to. */
  baseCurrency: string
  /** Additional currencies the user can spend in. Never includes baseCurrency. */
  currencies: string[]
  updatedAt: string
}

export interface CategoryRename {
  from: string
  to: string
}

/** Only the provided keys are written; the rest of the META item is left alone. */
export interface MetadataPatch {
  categories?: Category[]
  baseCurrency?: string
  currencies?: string[]
}
