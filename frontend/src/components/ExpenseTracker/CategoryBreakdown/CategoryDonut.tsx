import { useMemo } from 'react'
import { Donut, type DonutSlice } from '../Donut/Donut'
import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount } from '../../../utils/currency'
import type { CategorySlice } from './slices'

interface CategoryDonutProps {
  slices: CategorySlice[]
  total: number
  selected: string | null
  onSelect: (parent: string) => void
}

/**
 * The month's spend by category. All the geometry lives in `Donut`; this only maps a
 * `CategorySlice` onto it — a category's parent name is both its identity and its label.
 */
export function CategoryDonut({ slices, total, selected, onSelect }: CategoryDonutProps) {
  const { baseCurrency } = useCurrency()

  const donutSlices = useMemo<DonutSlice[]>(
    () =>
      slices.map((slice) => ({
        key: slice.parent,
        label: slice.parent,
        amount: slice.amount,
        percent: slice.percent,
        color: slice.color,
      })),
    [slices]
  )

  return (
    <Donut
      slices={donutSlices}
      total={total}
      centerLabel="Total"
      formatValue={(amount) => formatAmount(amount, baseCurrency)}
      selected={selected}
      onSelect={onSelect}
    />
  )
}
