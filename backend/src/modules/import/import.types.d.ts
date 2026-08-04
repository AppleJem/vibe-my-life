/**
 * Shapes for importing a Money Manager-style .xlsx backup.
 *
 * The source file carries three things this app has no schema for — accounts,
 * income rows and transfers. They are dropped or skipped, and every drop is
 * counted so the summary can tell the user exactly what did not make it in.
 */

/** One importable expense row, after parsing but before category mapping. */
export interface ParsedRow {
  date: string          // YYYY-MM-DD, read in UTC
  createdAt: string     // full ISO timestamp — preserves the file's time-of-day
  amount: number        // in the file's base currency, rounded to 2dp
  note: string          // Note, with Description appended when present
  sourceCategory: string
  sourceSubcategory: string | null
  account: string | null    // parsed for reporting only; never written
  baseCurrency: string
  // Present only when the row was spent in a non-base currency.
  currency?: string
  originalAmount?: number
  rate?: number
}

export interface SkipCounts {
  income: number
  transfer: number
  invalid: number
}

export interface ParseResult {
  baseCurrency: string
  rows: ParsedRow[]
  totalDataRows: number
  /** Rows imported with amount 0 — refunds, vouchers, "someone else paid". */
  zeroAmountRows: number
  skipped: SkipCounts
  accounts: string[]
  currencies: string[]
  warnings: string[]
}

/**
 * Where one distinct (Category, Subcategory) pair from the file should land.
 * `sub: null` means "file it directly under the parent, no subcategory".
 */
export interface CategoryMapping {
  sourceCategory: string
  sourceSubcategory: string | null
  parent: string
  sub: string | null
}

export interface MappingSuggestion extends CategoryMapping {
  count: number
  /** True when `parent` does not yet exist in the user's metadata. */
  parentIsNew: boolean
  /** True when `sub` is set and does not yet exist under `parent`. */
  subIsNew: boolean
}

export interface ImportPreview {
  baseCurrency: string
  totals: {
    rows: number
    importable: number
    skippedIncome: number
    skippedTransfer: number
    skippedInvalid: number
  }
  /** Imported, but worth calling out — refunds, vouchers, "someone else paid". */
  zeroAmountRows: number
  dateRange: { from: string; to: string } | null
  currencies: string[]
  accountsDropped: string[]
  duplicatesFound: number
  mappings: MappingSuggestion[]
  warnings: string[]
}

export interface ImportResult {
  imported: number
  skippedIncome: number
  skippedTransfer: number
  skippedInvalid: number
  skippedDuplicate: number
  categoriesCreated: string[]
}
