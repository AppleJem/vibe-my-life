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
