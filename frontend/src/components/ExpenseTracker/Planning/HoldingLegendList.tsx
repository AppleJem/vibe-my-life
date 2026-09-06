import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount } from '../../../utils/currency'
import type { HoldingSlice, PricedHolding } from './holdingSlices'
import type { Holding } from '../../../types/holding'

interface HoldingLegendListProps {
  slices: HoldingSlice[]
  /** Grouped by tag, a row expands into its holdings rather than opening the editor. */
  groupedByTag: boolean
  onSelectSlice: (key: string) => void
  onEditHolding: (holding: Holding) => void
}

/**
 * The ranked rows. This is also the chart's legend: past eight slices the donut's hues
 * repeat, so the swatch-plus-name pairing here is what keeps identity from resting on
 * colour alone.
 */
export function HoldingLegendList({
  slices,
  groupedByTag,
  onSelectSlice,
  onEditHolding,
}: HoldingLegendListProps) {
  const { baseCurrency } = useCurrency()

  return (
    <div className="space-y-2">
      {slices.map((slice) => {
        const single = !groupedByTag ? slice.holdings[0] : null

        return (
          <button
            key={slice.key}
            onClick={(e) => {
              e.stopPropagation()
              if (single) onEditHolding(single.holding)
              else onSelectSlice(slice.key)
            }}
            className="w-full flex items-center justify-between gap-3 p-4 bg-zinc-900 rounded-xl text-left hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <div className="min-w-0">
                <p className={`text-zinc-100 font-medium truncate ${groupedByTag ? 'capitalize' : ''}`}>
                  {slice.label}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {groupedByTag
                    ? `${slice.holdings.length} holding${slice.holdings.length === 1 ? '' : 's'}`
                    : subtitleFor(single!, baseCurrency)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-zinc-500 text-xs tabular-nums w-9 text-right">
                {slice.percent.toFixed(0)}%
              </span>
              <span className="text-zinc-100 font-semibold tabular-nums">
                {formatAmount(slice.amount, baseCurrency)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * A foreign-held holding leads with the figure actually sitting in the account — the
 * converted number is already the headline on the right, and seeing "US$20,000" is how
 * you recognise the deposit you opened.
 */
function subtitleFor({ holding }: PricedHolding, baseCurrency: string): string {
  const parts: string[] = []
  if (holding.tag) parts.push(holding.tag)
  // Only when it differs from the headline figure on the right — repeating the same
  // number in two places would just be noise.
  if (holding.currency !== baseCurrency) {
    parts.push(formatAmount(holding.amount, holding.currency))
  }
  return parts.join(' · ')
}

interface UnconvertibleNoticeProps {
  holdings: Holding[]
}

/**
 * Says out loud what the chart is leaving out. A holding priced in a currency with no
 * rate is excluded from both the ring and the total, and a silently smaller net worth is
 * worse than a visible gap.
 */
export function UnconvertibleNotice({ holdings }: UnconvertibleNoticeProps) {
  if (holdings.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-medium text-amber-300">
        {holdings.length === 1 ? '1 holding is' : `${holdings.length} holdings are`} not
        counted below
      </p>
      <p className="mt-1 text-xs text-amber-300/70">
        No exchange rate is available for{' '}
        {[...new Set(holdings.map((h) => h.currency))].join(', ')}. Reconnect to include{' '}
        {holdings.length === 1 ? 'it' : 'them'} in the total.
      </p>
      <div className="mt-2 space-y-1">
        {holdings.map((holding) => (
          <p key={holding.id} className="text-xs text-amber-200/60 tabular-nums">
            {holding.name} · {formatAmount(holding.amount, holding.currency)}
          </p>
        ))}
      </div>
    </div>
  )
}
