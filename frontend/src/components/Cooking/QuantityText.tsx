import { formatQuantity, splitQuantityText, type UnitSystem } from '../../utils/units'
import type { Quantity } from '../../types/recipe'

interface QuantityTextProps {
  text: string
  quantities?: Quantity[]
  factor: number
  system: UnitSystem
  /**
   * Renders the amounts in the surrounding text colour instead of the accent. For a step that
   * is already done: its amounts are no longer something to look for.
   */
  muted?: boolean
}

/**
 * A step's prose with its amounts rendered in place of the `{0}`, `{1}` … markers that
 * stand where they were written.
 *
 * The substituted amounts are set apart rather than blended in: they are the parts of the
 * sentence that just changed under the servings stepper, and a cook scanning a step for
 * "how much" should find them without reading it.
 */
export function QuantityText({ text, quantities, factor, system, muted }: QuantityTextProps) {
  const segments = splitQuantityText(text, quantities, { factor, system })

  return (
    <>
      {segments.map((segment, index) =>
        segment.isQuantity ? (
          <span
            key={index}
            className={`font-semibold tabular-nums ${muted ? '' : 'text-amber-400'}`}
          >
            {segment.text}
          </span>
        ) : (
          // Markers are indexes into a list, so two adjacent prose runs are possible and
          // the array index is the only stable key there is.
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  )
}

/** One standalone amount — an ingredient's, where there is no prose around it. */
export function QuantityValue({
  quantity,
  factor,
  system,
}: {
  quantity: Quantity
  factor: number
  system: UnitSystem
}) {
  return (
    <span className="font-semibold text-amber-400 tabular-nums">
      {formatQuantity(quantity, { factor, system })}
    </span>
  )
}
