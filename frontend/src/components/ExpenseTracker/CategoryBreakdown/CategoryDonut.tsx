import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount } from '../../../utils/currency'
import { layoutLabels, donutHeight } from './labelLayout'
import type { CategorySlice } from './slices'

interface CategoryDonutProps {
  slices: CategorySlice[]
  total: number
  selected: string | null
  onSelect: (parent: string) => void
}

const RAD = Math.PI / 180
const PADDING_ANGLE = 2
const OUTER_RADIUS = 84
const INNER_RADIUS = 56
/** Two lines of 10px text, plus breathing room between neighbours. */
const LINE_HEIGHT = 26
/** Gap between the ring and the label column. */
const GUTTER = 18

/** Label ink: the selected slice's label is lifted, the rest recede behind it. */
function labelFill(isSelected: boolean, hasSelection: boolean): string {
  if (isSelected) return '#fafafa' // zinc-50
  return hasSelection ? '#52525b' : '#a1a1aa' // zinc-600 / zinc-400
}

export function CategoryDonut({ slices, total, selected, onSelect }: CategoryDonutProps) {
  const { baseCurrency } = useCurrency()
  const active = selected ? slices.find((s) => s.parent === selected) : null

  const { height, layout } = useMemo(() => {
    const percents = slices.map((s) => s.percent)
    const h = donutHeight(percents, LINE_HEIGHT, PADDING_ANGLE)

    return {
      height: h,
      layout: layoutLabels(percents, h / 2, OUTER_RADIUS + GUTTER, LINE_HEIGHT, PADDING_ANGLE, h),
    }
  }, [slices])

  // Recharts hands each label its slice's true mid-angle, so the leader line
  // always leaves from the right sector; only the label's vertical position
  // comes from the de-collided layout.
  const renderLabel = ({ cx, cy, midAngle, outerRadius, index }: any) => {
    const slice = slices[index]
    const pos = layout[index]
    if (!slice || !pos) return <g />

    const isSelected = selected === slice.parent
    const dimmed = Boolean(selected) && !isSelected
    const onRight = pos.side === 'R'

    const columnX = onRight ? cx + outerRadius + GUTTER : cx - outerRadius - GUTTER
    const elbowX = onRight ? columnX - 8 : columnX + 8
    const start = {
      x: cx + (outerRadius + 3) * Math.cos(-midAngle * RAD),
      y: cy + (outerRadius + 3) * Math.sin(-midAngle * RAD),
    }

    return (
      <g opacity={dimmed ? 0.45 : 1}>
        <polyline
          points={`${start.x},${start.y} ${elbowX},${pos.y} ${columnX},${pos.y}`}
          stroke={slice.color}
          strokeWidth={1}
          fill="none"
        />
        <text
          x={columnX}
          y={pos.y}
          textAnchor={onRight ? 'start' : 'end'}
          fill={labelFill(isSelected, Boolean(selected))}
          fontSize={10}
          fontWeight={isSelected ? 700 : 500}
        >
          <tspan x={columnX} dy="-0.2em">
            {slice.parent}
          </tspan>
          <tspan x={columnX} dy="1.2em" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {`${slice.percent.toFixed(0)}%`}
          </tspan>
        </text>
      </g>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="parent"
            innerRadius={INNER_RADIUS}
            outerRadius={OUTER_RADIUS}
            // Clockwise from twelve o'clock — the layout helper assumes it.
            startAngle={90}
            endAngle={-270}
            // The 2px gap keeps adjacent fills from bleeding into one another —
            // it is part of how the palette stays readable, not decoration.
            paddingAngle={PADDING_ANGLE}
            stroke="none"
            isAnimationActive={false}
            label={renderLabel}
            labelLine={false}
            onClick={(_data, index, event) => {
              // Let the wrapper's clear-on-background-click only fire for clicks
              // that miss a slice.
              event?.stopPropagation?.()
              onSelect(slices[index].parent)
            }}
            className="cursor-pointer focus:outline-none"
          >
            {slices.map((slice) => (
              <Cell
                key={slice.parent}
                fill={slice.color}
                opacity={selected && selected !== slice.parent ? 0.35 : 1}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centred in the hole. `pointer-events-none` so it never eats a slice click
          or blocks the background click that clears the selection. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-zinc-500 text-xs max-w-24 text-center truncate">
          {active ? active.parent : 'Total'}
        </p>
        <p className="text-zinc-100 text-lg font-bold tabular-nums">
          {formatAmount(active ? active.amount : total, baseCurrency)}
        </p>
      </div>
    </div>
  )
}
