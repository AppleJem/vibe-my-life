export const DEFAULT_BASE_CURRENCY = 'SGD'

export interface CurrencyMeta {
  symbol: string
  /** Fraction digits to render. JPY, KRW, VND and IDR are conventionally whole-unit. */
  decimals: number
  name: string
}

/**
 * Presentation metadata for the currencies people are most likely to pick. The
 * selectable list is driven by whatever codes the rates API returns, so anything
 * missing here falls back to `metaFor`'s default rather than needing an entry.
 */
export const CURRENCY_META: Record<string, CurrencyMeta> = {
  SGD: { symbol: 'S$', decimals: 2, name: 'Singapore Dollar' },
  JPY: { symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  CNY: { symbol: '¥', decimals: 2, name: 'Chinese Yuan' },
  HKD: { symbol: 'HK$', decimals: 2, name: 'Hong Kong Dollar' },
  KRW: { symbol: '₩', decimals: 0, name: 'South Korean Won' },
  TWD: { symbol: 'NT$', decimals: 2, name: 'New Taiwan Dollar' },
  THB: { symbol: '฿', decimals: 2, name: 'Thai Baht' },
  MYR: { symbol: 'RM', decimals: 2, name: 'Malaysian Ringgit' },
  IDR: { symbol: 'Rp', decimals: 0, name: 'Indonesian Rupiah' },
  VND: { symbol: '₫', decimals: 0, name: 'Vietnamese Dong' },
  PHP: { symbol: '₱', decimals: 2, name: 'Philippine Peso' },
  INR: { symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  AUD: { symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  NZD: { symbol: 'NZ$', decimals: 2, name: 'New Zealand Dollar' },
  CAD: { symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
  CHF: { symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
  AED: { symbol: 'AED', decimals: 2, name: 'UAE Dirham' },
}

const FALLBACK_DECIMALS = 2

/** Unknown codes render with the code itself standing in for a symbol. */
export function metaFor(code: string): CurrencyMeta {
  return CURRENCY_META[code] ?? { symbol: code, decimals: FALLBACK_DECIMALS, name: code }
}
