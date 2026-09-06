import { useMemo, useState } from 'react'
import { Donut, type DonutSlice } from '../Donut/Donut'
import { HoldingLegendList, UnconvertibleNotice } from './HoldingLegendList'
import { HoldingEditor } from './HoldingEditor'
import { buildHoldingSlices, existingTags, type GroupBy } from './holdingSlices'
import { useHoldings } from '../../../hooks/useHoldings'
import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount } from '../../../utils/currency'
import type { Holding } from '../../../types/holding'

const GROUPINGS: { value: GroupBy; label: string }[] = [
  { value: 'holding', label: 'By holding' },
  { value: 'tag', label: 'By tag' },
]

/**
 * Where the money sits, rather than where it went.
 *
 * Unlike the other two dashboard views this one is not scoped to a month: a balance is a
 * present-value figure, so there is no period to page through. It is also the only view
 * whose figures are computed against live exchange rates at render time — see
 * `holdingSlices.ts` for why a holding stores its native currency instead of a snapshot.
 */
export function PlanningView() {
  const { baseCurrency, rates, ratesFetchedAt } = useCurrency()
  const { holdings, loading, error, createHolding, updateHolding, deleteHolding } =
    useHoldings()

  const [groupBy, setGroupBy] = useState<GroupBy>('holding')
  const [selected, setSelected] = useState<string | null>(null)
  /** `'new'` is a blank editor; a holding is an edit. Both replace the list in place. */
  const [editing, setEditing] = useState<Holding | 'new' | null>(null)

  const breakdown = useMemo(
    () => buildHoldingSlices(holdings, groupBy, baseCurrency, rates),
    [holdings, groupBy, baseCurrency, rates]
  )

  const tags = useMemo(() => existingTags(holdings), [holdings])

  const donutSlices = useMemo<DonutSlice[]>(
    () =>
      breakdown.slices.map((slice) => ({
        key: slice.key,
        label: slice.label,
        amount: slice.amount,
        percent: slice.percent,
        color: slice.color,
      })),
    [breakdown.slices]
  )

  if (editing) {
    return (
      <HoldingEditor
        holding={editing === 'new' ? null : editing}
        tags={tags}
        onClose={() => setEditing(null)}
        onCreate={createHolding}
        onUpdate={updateHolding}
        onDelete={deleteHolding}
      />
    )
  }

  // The grouping switcher renders above every branch — an empty state must still be able
  // to show what the toggle does once something is added.
  const switcher = (
    <div className="flex justify-center mb-4" onClick={(e) => e.stopPropagation()}>
      <div className="inline-flex rounded-full bg-zinc-900 p-1">
        {GROUPINGS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => {
              setGroupBy(value)
              // The selected key belongs to the other grouping.
              setSelected(null)
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              groupBy === value
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const addButton = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setEditing('new')
      }}
      className="mt-4 w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
    >
      Add holding
    </button>
  )

  if (loading) {
    return (
      <div className="space-y-3">
        {switcher}
        <div className="h-64 bg-zinc-800 rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div>
        {switcher}
        <div className="text-center py-12">
          <p className="text-zinc-500 text-sm">Nothing here yet</p>
          <p className="text-zinc-600 text-xs mt-1 max-w-xs mx-auto">
            Add the pots your money sits in — a housing fund, an emergency fund, a fixed
            deposit — to see how it's split.
          </p>
        </div>
        {addButton}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  const active = selected
    ? breakdown.slices.find((s) => s.key === selected) ?? null
    : null

  return (
    // Clicking anywhere that isn't a slice or a row clears the selection.
    <div onClick={() => setSelected(null)}>
      {switcher}

      <UnconvertibleNotice holdings={breakdown.unconvertible} />

      {breakdown.slices.length > 0 && (
        <>
          <Donut
            slices={donutSlices}
            total={breakdown.total}
            centerLabel="Net worth"
            formatValue={(amount) => formatAmount(amount, baseCurrency)}
            selected={active?.key ?? null}
            onSelect={(key) => setSelected((prev) => (prev === key ? null : key))}
          />

          {breakdown.hasForeign && ratesFetchedAt && (
            <p className="mt-2 text-center text-xs text-zinc-600">
              Foreign balances converted at rates from{' '}
              {new Date(ratesFetchedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </>
      )}

      <div className="mt-6">
        {active && groupBy === 'tag' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: active.color }}
                />
                <span className="text-zinc-100 font-medium truncate capitalize">
                  {active.label}
                </span>
                <span className="text-zinc-500 text-sm tabular-nums shrink-0">
                  {formatAmount(active.amount, baseCurrency)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected(null)
                }}
                className="text-zinc-500 hover:text-zinc-100 transition-colors p-1 shrink-0"
                aria-label="Clear tag filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* The tag's own holdings, coloured by the slice they came from so the drill-in
                still reads as part of that wedge. */}
            <HoldingLegendList
              slices={active.holdings.map((entry) => ({
                key: entry.holding.id,
                label: entry.holding.name,
                amount: entry.baseAmount,
                percent: active.amount > 0 ? (entry.baseAmount / active.amount) * 100 : 0,
                color: active.color,
                holdings: [entry],
              }))}
              groupedByTag={false}
              onSelectSlice={() => {}}
              onEditHolding={setEditing}
            />
          </>
        ) : (
          <HoldingLegendList
            slices={breakdown.slices}
            groupedByTag={groupBy === 'tag'}
            onSelectSlice={(key) => setSelected((prev) => (prev === key ? null : key))}
            onEditHolding={setEditing}
          />
        )}
      </div>

      {addButton}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  )
}
