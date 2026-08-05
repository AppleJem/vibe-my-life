import { metaFor } from '../constants/currencies'

export function symbolFor(code: string): string {
  return metaFor(code).symbol
}

export function decimalsFor(code: string): number {
  return metaFor(code).decimals
}

/**
 * e.g. formatAmount(12.8, 'SGD') → "S$12.80"; formatAmount(1500, 'JPY') → "¥1,500".
 *
 * The sign leads the symbol — "-S$12.50", not "S$-12.50". Stored amounts are always
 * positive magnitudes, but derived figures (a month's net, a day's subtotal) are not.
 */
export function formatAmount(amount: number, code: string): string {
  const { symbol, decimals } = metaFor(code)
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`
}

/**
 * Converts a foreign amount to the base currency. `rate` is units of the foreign
 * currency per 1 unit of base, so the conversion is a division.
 */
export function toBase(originalAmount: number, rate: number, baseCode: string): number {
  const factor = 10 ** decimalsFor(baseCode)
  return Math.round((originalAmount / rate) * factor) / factor
}

interface PricedItem {
  amount: number
  currency?: string
  originalAmount?: number
  rate?: number
  baseCurrency?: string
}

/**
 * Moves a parsed item's amount into the base currency, given rates fetched after the
 * parse. A parser (LLM or OCR) reports what it heard or read — "3000 yen" — and has no
 * rates to convert with, so this is where a foreign figure becomes a storable expense:
 * `amount` ends up in the base currency and the spoken figure moves to `originalAmount`,
 * exactly the shape `AddExpenseModal` produces for a hand-entered foreign expense.
 *
 * When no rate is available for the code, the item keeps `currency` and gains
 * `originalAmount` but no `rate` — deliberately unpriced, so callers can flag it rather
 * than silently banking a yen figure as dollars. `hasUsableRate` is the check for that.
 */
export function priceInBase<T extends PricedItem>(
  item: T,
  baseCurrency: string,
  rates: Record<string, number>
): T {
  // No currency, or one that matches the base, means the amount is already base-priced.
  if (!item.currency || item.currency === baseCurrency) {
    const { currency: _unused, originalAmount: _also, rate: _too, ...rest } = item
    return { ...rest, baseCurrency } as T
  }

  const rate = rates[item.currency]
  if (typeof rate !== 'number' || rate <= 0) {
    return { ...item, originalAmount: item.amount, baseCurrency }
  }

  return {
    ...item,
    amount: toBase(item.amount, rate, baseCurrency),
    originalAmount: item.amount,
    rate,
    baseCurrency,
  }
}

/** False only for a foreign item that `priceInBase` could not find a rate for. */
export function hasUsableRate(item: PricedItem): boolean {
  return !item.currency || (typeof item.rate === 'number' && item.rate > 0)
}

/**
 * Renders a rate in whichever direction reads as "1 of the stronger unit". With a
 * base of SGD: JPY (rate 122.46) → "1 SGD = 122.46 JPY", USD (rate 0.78) →
 * "1 USD = 1.28 SGD".
 */
export function formatRate(base: string, target: string, rate: number): string {
  if (rate >= 1) {
    return `1 ${base} = ${trim(rate)} ${target}`
  }
  return `1 ${target} = ${trim(1 / rate)} ${base}`
}

/** Rates need more precision than money: keep up to 4 significant decimals, drop trailing zeros. */
function trim(value: number): string {
  const decimals = value >= 100 ? 2 : value >= 1 ? 4 : 6
  return String(Number(value.toFixed(decimals)))
}
