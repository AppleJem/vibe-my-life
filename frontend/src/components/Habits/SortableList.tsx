import { useRef } from 'react'
import { useSprings, animated, type AnimatedProps } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import type { HTMLAttributes, ReactNode } from 'react'

const AnimatedDiv = animated.div as React.ComponentType<
  AnimatedProps<HTMLAttributes<HTMLDivElement>>
>

interface SortableListProps<T> {
  items: T[]
  keyOf: (item: T) => string
  /** Committed on release, and only when the order actually changed. */
  onReorder: (items: T[]) => void
  children: (item: T) => ReactNode
}

/** Row height plus the gap between rows — what one position is worth, in pixels. */
const ROW_HEIGHT = 64
const GAP = 8
const STRIDE = ROW_HEIGHT + GAP

/** Where each row sits given the current order. `order[i]` is the row rendered at slot `i`. */
const layout = (order: number[], dragging: number | null, y: number) =>
  (index: number) => {
    if (index === dragging) {
      return {
        y: order.indexOf(index) * STRIDE + y,
        scale: 1.03,
        zIndex: 1,
        shadow: 1,
        immediate: (key: string) => key === 'y' || key === 'zIndex',
      }
    }

    return {
      y: order.indexOf(index) * STRIDE,
      scale: 1,
      zIndex: 0,
      shadow: 0,
      immediate: false,
    }
  }

/** Moves `from` to `to`, shifting everything between. */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/**
 * Drag one row at a time to reorder, on `@use-gesture` and `@react-spring` — the pair the
 * expense swipe already uses, so no new dependency.
 *
 * Rows are absolutely positioned and moved by transform rather than reflowed, which is what
 * lets the ones being displaced slide out of the way while the dragged row follows the
 * finger. The order is kept in a ref during the gesture: it changes on every frame the
 * finger crosses a row boundary, and re-rendering the whole list that often would fight the
 * springs.
 *
 * The drag lives on a handle rather than the whole row, so the row itself is still free to
 * be a link.
 */
export function SortableList<T>({ items, keyOf, onReorder, children }: SortableListProps<T>) {
  const order = useRef(items.map((_, i) => i))

  // A row added or removed while mounted invalidates the indices outright.
  const signature = items.map(keyOf).join('|')
  const lastSignature = useRef(signature)
  if (lastSignature.current !== signature) {
    lastSignature.current = signature
    order.current = items.map((_, i) => i)
  }

  const [springs, api] = useSprings(items.length, layout(order.current, null, 0), [signature])

  const bind = useDrag(({ args: [index], active, movement: [, my], last }) => {
    const from = order.current.indexOf(index as number)
    const to = Math.max(0, Math.min(items.length - 1, Math.round(from + my / STRIDE)))
    const next = move(order.current, from, to)

    api.start(layout(next, active ? (index as number) : null, my))

    if (!last) return

    order.current = next

    const reordered = next.map((i) => items[i])
    const changed = reordered.some((item, i) => keyOf(item) !== keyOf(items[i]))
    if (changed) onReorder(reordered)
  }, { axis: 'y', filterTaps: true })

  return (
    <div className="relative" style={{ height: items.length * STRIDE - GAP }}>
      {springs.map(({ y, scale, zIndex, shadow }, index) => (
        <AnimatedDiv
          key={keyOf(items[index])}
          style={{
            position: 'absolute',
            insetInline: 0,
            height: ROW_HEIGHT,
            y,
            scale,
            zIndex,
            boxShadow: shadow.to((s) => `0 ${s * 10}px ${s * 20}px rgba(0,0,0,${s * 0.4})`),
            borderRadius: 12,
            touchAction: 'none',
          } as never}
        >
          <div className="flex items-center h-full gap-2">
            <div className="flex-1 min-w-0 h-full">{children(items[index])}</div>

            {/* The only draggable surface. `touch-none` keeps the browser from claiming
                the gesture as a page scroll halfway through. */}
            <button
              {...bind(index)}
              aria-label="Drag to reorder"
              className="shrink-0 px-3 h-full text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              ☰
            </button>
          </div>
        </AnimatedDiv>
      ))}
    </div>
  )
}
