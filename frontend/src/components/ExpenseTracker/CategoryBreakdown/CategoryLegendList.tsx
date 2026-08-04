import type { CategorySlice } from './slices'

interface CategoryLegendListProps {
  slices: CategorySlice[]
  onSelect: (parent: string) => void
}

/**
 * The ranked category rows. This is also the chart's legend: past eight
 * categories the donut's hues repeat, so the swatch-plus-name pairing here is
 * what keeps identity from resting on colour alone.
 */
export function CategoryLegendList({ slices, onSelect }: CategoryLegendListProps) {
  return (
    <div className="space-y-2">
      {slices.map((slice) => (
        <button
          key={slice.parent}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(slice.parent)
          }}
          className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl text-left hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-zinc-100 font-medium truncate">{slice.parent}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-zinc-500 text-xs tabular-nums w-9 text-right">
              {slice.percent.toFixed(0)}%
            </span>
            <span className="text-zinc-100 font-semibold tabular-nums">{slice.label}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
