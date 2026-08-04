import ExcelJS from 'exceljs'
import type { ParsedRow, ParseResult, SkipCounts } from './import.types.d.js'

/**
 * Parses a Money Manager-style .xlsx export into expense rows.
 *
 * The expected sheet has one header row and these columns (order is NOT assumed —
 * everything is resolved by header text):
 *
 *   Period | Accounts | Category | Subcategory | Note | <BASE> | Income/Expense |
 *   Description | Amount | Currency | Accounts
 *
 * `<BASE>` is a bare 3-letter currency code (e.g. "SGD") and holds the amount
 * converted to the user's base currency — that is where the file tells us what its
 * base currency is. `Amount` + `Currency` hold the amount as originally spent.
 *
 * The header "Accounts" appears twice: the first is the account name, the trailing
 * one duplicates the base-amount column. Both are resolved positionally and dropped.
 */

const CURRENCY_CODE = /^[A-Z]{3}$/

/** Header text -> the canonical field it feeds. */
const HEADERS = {
  period: 'period',
  category: 'category',
  subcategory: 'subcategory',
  note: 'note',
  type: 'income/expense',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  accounts: 'accounts',
} as const

class ImportParseError extends Error {}

export { ImportParseError }

/** Excel's epoch under the 1900 date system, as used by exceljs. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

/**
 * Excel serials carry a fractional time-of-day even when the cell's number format
 * only shows a date (this file formats Period as `dd/MM/yyyy`, but the underlying
 * values are timestamps). We keep the whole instant and let the caller decide.
 *
 * Everything is read in UTC deliberately: using local-time getters would shift every
 * row by a day for anyone west of Greenwich.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(EXCEL_EPOCH_UTC + value * MS_PER_DAY)
  }

  // Fall back to a parseable string, e.g. if the export was re-saved as text.
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim())
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

/** Unwraps the shapes exceljs uses for rich text, formulas and hyperlinks. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()

  const obj = value as Record<string, unknown>
  if (typeof obj.text === 'string') return obj.text.trim()
  if (Array.isArray(obj.richText)) {
    return obj.richText.map((part) => (part as { text?: string }).text ?? '').join('').trim()
  }
  if ('result' in obj) return cellText(obj.result)
  if ('hyperlink' in obj && typeof obj.hyperlink === 'string') return obj.hyperlink.trim()

  return ''
}

function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const text = cellText(value)
  if (!text) return null

  // Tolerate thousands separators and a currency symbol prefix.
  const cleaned = text.replace(/[,\s]/g, '').replace(/^[^\d.\-+]+/, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const round = (value: number, dp: number): number => {
  const factor = 10 ** dp
  return Math.round(value * factor) / factor
}

interface ColumnMap {
  period: number
  category: number
  subcategory: number | null
  note: number | null
  type: number
  description: number | null
  amount: number
  currency: number
  account: number | null
  base: number
  baseCurrency: string
}

function resolveColumns(headerRow: ExcelJS.Row): ColumnMap {
  const seen: { text: string; index: number }[] = []

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value)
    if (text) seen.push({ text, index: colNumber })
  })

  const find = (name: string): number | null => {
    const hit = seen.find((h) => h.text.toLowerCase() === name)
    return hit ? hit.index : null
  }

  // A bare 3-letter code as a header is the base-currency amount column.
  const baseHeader = seen.find((h) => CURRENCY_CODE.test(h.text))
  if (!baseHeader) {
    throw new ImportParseError(
      'Could not find the base-currency column. Expected a header that is a 3-letter currency code, such as "SGD".'
    )
  }

  const required = {
    period: find(HEADERS.period),
    category: find(HEADERS.category),
    type: find(HEADERS.type),
    amount: find(HEADERS.amount),
    currency: find(HEADERS.currency),
  }

  const missing = Object.entries(required)
    .filter(([, index]) => index === null)
    .map(([field]) => field)

  if (missing.length > 0) {
    throw new ImportParseError(
      `This does not look like a supported backup file. Missing column(s): ${missing.join(', ')}.`
    )
  }

  // "Accounts" appears twice; the first is the account name, the second duplicates
  // the base amount. Take the first and ignore the rest.
  const accountHit = seen.find((h) => h.text.toLowerCase() === HEADERS.accounts)

  return {
    period: required.period!,
    category: required.category!,
    subcategory: find(HEADERS.subcategory),
    note: find(HEADERS.note),
    type: required.type!,
    description: find(HEADERS.description),
    amount: required.amount!,
    currency: required.currency!,
    account: accountHit ? accountHit.index : null,
    base: baseHeader.index,
    baseCurrency: baseHeader.text.toUpperCase(),
  }
}

type RowKind = 'expense' | 'income' | 'transfer' | 'unknown'

function classify(type: string): RowKind {
  const normalized = type.toLowerCase().replace(/\.$/, '').trim()
  if (normalized === 'exp' || normalized === 'expense') return 'expense'
  if (normalized === 'income') return 'income'
  if (normalized.startsWith('transfer')) return 'transfer'
  return 'unknown'
}

export async function parseBackup(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new ImportParseError('Could not read the file. Make sure it is a valid .xlsx spreadsheet.')
  }

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) {
    throw new ImportParseError('The spreadsheet has no data rows.')
  }

  const columns = resolveColumns(sheet.getRow(1))

  const rows: ParsedRow[] = []
  const skipped: SkipCounts = { income: 0, transfer: 0, invalid: 0 }
  const warnings: string[] = []
  const accounts = new Set<string>()
  const currencies = new Set<string>()
  let totalDataRows = 0
  let zeroAmountRows = 0

  const warn = (message: string) => {
    // Keep the payload bounded — a badly broken file shouldn't produce 450 warnings.
    if (warnings.length < 20) warnings.push(message)
    else if (warnings.length === 20) warnings.push('Further warnings suppressed.')
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const at = (index: number | null) => (index === null ? undefined : row.getCell(index).value)

    const typeText = cellText(at(columns.type))
    const categoryText = cellText(at(columns.category))
    const baseValue = cellNumber(at(columns.base))

    // A row with nothing in any of the three load-bearing columns is trailing
    // whitespace in the sheet, not a broken record.
    if (!typeText && !categoryText && baseValue === null) continue

    totalDataRows++

    const account = cellText(at(columns.account))
    if (account) accounts.add(account)

    const currencyText = cellText(at(columns.currency)).toUpperCase()
    if (currencyText) currencies.add(currencyText)

    const kind = classify(typeText)
    if (kind === 'income') {
      skipped.income++
      continue
    }
    if (kind === 'transfer') {
      skipped.transfer++
      continue
    }
    if (kind === 'unknown') {
      skipped.invalid++
      warn(`Row ${rowNumber}: unrecognised Income/Expense value "${typeText}" — skipped.`)
      continue
    }

    const date = toDate(at(columns.period))
    if (!date) {
      skipped.invalid++
      warn(`Row ${rowNumber}: unreadable date — skipped.`)
      continue
    }

    if (baseValue === null || baseValue < 0) {
      skipped.invalid++
      warn(`Row ${rowNumber}: missing or negative amount — skipped.`)
      continue
    }

    if (!categoryText) {
      skipped.invalid++
      warn(`Row ${rowNumber}: no category — skipped.`)
      continue
    }

    // Raw base amounts carry float artifacts (9.369999999999999) from the source app.
    const amount = round(baseValue, 2)

    // Zero is a real, deliberate value in these exports — a refunded purchase, a meal
    // a friend paid for, something covered by a voucher. The note is the whole point
    // of the record, so keep it rather than treating it as a broken row.
    if (amount === 0) zeroAmountRows++

    const note = cellText(at(columns.note))
    const description = cellText(at(columns.description))

    const parsed: ParsedRow = {
      date: date.toISOString().slice(0, 10),
      createdAt: date.toISOString(),
      amount,
      // Note is the short label, Description the long-form remark. Keeping both
      // is the difference between "Giga! plan" and knowing why it's dated the 1st.
      note: [note, description].filter(Boolean).join(' — '),
      sourceCategory: categoryText,
      sourceSubcategory: cellText(at(columns.subcategory)) || null,
      account: account || null,
      baseCurrency: columns.baseCurrency,
    }

    // The three foreign fields travel together, and stay absent entirely when the
    // spend was in the base currency — that absence is the app's "not foreign" signal.
    const originalAmount = cellNumber(at(columns.amount))
    if (currencyText && currencyText !== columns.baseCurrency && amount > 0) {
      if (originalAmount === null || originalAmount <= 0) {
        warn(`Row ${rowNumber}: ${currencyText} row has no original amount — importing the ${columns.baseCurrency} amount only.`)
      } else {
        parsed.currency = currencyText
        parsed.originalAmount = round(originalAmount, 6)
        // `rate` is units of foreign per 1 base, which is what the app divides by.
        parsed.rate = round(originalAmount / amount, 6)
      }
    }

    rows.push(parsed)
  }

  if (rows.length === 0 && skipped.income === 0 && skipped.transfer === 0) {
    throw new ImportParseError('No importable rows were found in this file.')
  }

  return {
    baseCurrency: columns.baseCurrency,
    rows,
    totalDataRows,
    zeroAmountRows,
    skipped,
    accounts: [...accounts],
    currencies: [...currencies],
    warnings,
  }
}

/**
 * Strips emoji, variation selectors, ZWJ and skin-tone modifiers so that
 * "🚖 Transport" and "🚗 Transport" compare equal. Used only to suggest a mapping —
 * the user confirms every pair before anything is written.
 */
export function normalizeCategoryName(name: string): string {
  return name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '')
    .replace(/[\u{FE0E}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
