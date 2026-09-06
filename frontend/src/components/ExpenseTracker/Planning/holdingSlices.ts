import { assignHoldingColors } from '../../../constants/planningColors'
import { toBase } from '../../../utils/currency'
import type { Holding } from '../../../types/holding'

/** What the donut slices by. */
export type GroupBy = 'holding' | 'tag'

/** The label a tagless holding is grouped under. */
export const UNTAGGED = 'Untagged'

export interface HoldingSlice {
  /** Identity: a holding id, or a tag name. Stable across re-sorts. */
  key: string
  label: string
  /** Value in the base currency. */
  amount: number
  /** 0–100, share of the convertible total. */
  percent: number
  color: string
  /** The holdings this slice covers, value descending. */
  holdings: PricedHolding[]
}

export interface PricedHolding {
  holding: Holding
  /** Value in the base currency. */
  baseAmount: number
}

export interface HoldingBreakdown {
  slices: HoldingSlice[]
  /** Sum of everything that could be converted. The figure in the donut's hole. */
  total: number
  /**
   * Holdings held in a currency no rate was available for. Excluded from `slices` and
   * from `total` — see the note on `priceAll` below.
   */
  unconvertible: Holding[]
  /** True when at least one holding is held outside the base currency. */
  hasForeign: boolean
}

/**
 * Values every holding in the base currency.
 *
 * A holding with no usable rate is *dropped*, not counted at face value. Treating a
 * ¥3,000,000 deposit as if it were 3,000,000 dollars would overstate net worth by a
 * factor of a hundred and there would be nothing on screen to say so — the same stance
 * `priceInBase`/`hasUsableRate` take in `utils/currency.ts`. The caller surfaces what was
 * left out.
 */
function priceAll(
  holdings: Holding[],
  baseCurrency: string,
  rates: Record<string, number>
): { priced: PricedHolding[]; unconvertible: Holding[] } {
  const priced: PricedHolding[] = []
  const unconvertible: Holding[] = []

  for (const holding of holdings) {
    if (holding.currency === baseCurrency) {
      priced.push({ holding, baseAmount: holding.amount })
      continue
    }

    const rate = rates[holding.currency]
    if (typeof rate !== 'number' || rate <= 0) {
      unconvertible.push(holding)
      continue
    }

    priced.push({ holding, baseAmount: toBase(holding.amount, rate, baseCurrency) })
  }

  return { priced, unconvertible }
}

/**
 * Ranked slices for the donut and the list beneath it.
 *
 * Colours are assigned in value order, which means the ring order the palette was
 * validated against is the order actually rendered. Grouping by tag collapses holdings
 * that share one — the single-tag rule is what makes that unambiguous, since no holding
 * can land in two slices.
 */
export function buildHoldingSlices(
  holdings: Holding[],
  groupBy: GroupBy,
  baseCurrency: string,
  rates: Record<string, number>
): HoldingBreakdown {
  const { priced, unconvertible } = priceAll(holdings, baseCurrency, rates)
  const total = priced.reduce((sum, p) => sum + p.baseAmount, 0)

  const groups = new Map<string, { label: string; holdings: PricedHolding[] }>()

  for (const entry of priced) {
    const key = groupBy === 'tag' ? entry.holding.tag || UNTAGGED : entry.holding.id
    const label = groupBy === 'tag' ? entry.holding.tag || UNTAGGED : entry.holding.name

    const group = groups.get(key)
    if (group) group.holdings.push(entry)
    else groups.set(key, { label, holdings: [entry] })
  }

  const ranked = [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      amount: group.holdings.reduce((sum, p) => sum + p.baseAmount, 0),
      holdings: [...group.holdings].sort((a, b) => b.baseAmount - a.baseAmount),
    }))
    .sort((a, b) => b.amount - a.amount)

  const colors = assignHoldingColors(ranked.length)

  return {
    slices: ranked.map((entry, i) => ({
      ...entry,
      color: colors[i],
      percent: total > 0 ? (entry.amount / total) * 100 : 0,
    })),
    total,
    unconvertible,
    hasForeign: holdings.some((h) => h.currency !== baseCurrency),
  }
}

/** Tags already in use, for the editor's suggestions. Alphabetical, no blanks. */
export function existingTags(holdings: Holding[]): string[] {
  return [...new Set(holdings.map((h) => h.tag).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}
