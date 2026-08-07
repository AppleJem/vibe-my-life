import { useState, useRef, useCallback, useEffect } from 'react'
import { accentOf } from '../../constants/habitColors'
import { buildMonthHeatmap, formatMonth, formatShortDate, formatValue } from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface HabitHeatmapProps {
  habit: Habit
  completions: Completion[]
  today: string
  /** `YYYY-MM`. Defaults to the month `today` falls in. */
  month?: string
  /**
   * Long-pressing an unlogged day asks to backfill it. Absent means the grid is
   * read-only — a tap still selects a day to read its value.
   */
  onBackdate?: (date: string) => void
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Short enough to feel deliberate, long enough not to fire on a tap. */
const LONG_PRESS_MS = 500

/** A press that drifts this far is someone scrolling the page, not picking a day. */
const MOVE_TOLERANCE = 10

export function HabitHeatmap({ habit, completions, today, month, onBackdate }: HabitHeatmapProps) {
  const accent = accentOf(habit.color)
  const grid = buildMonthHeatmap(habit, completions, today, month)
  const [selected, setSelected] = useState<{ date: string; completion: Completion | null } | null>(
    null
  )

  const timerRef = useRef<number | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  // Set when a hold completes, so the click that follows selects nothing — otherwise
  // releasing after a backdate would also move the caption to that day.
  const firedRef = useRef(false)

  const cancelPress = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    originRef.current = null
  }, [])

  // Navigating away mid-hold must not leave a timer that fires into a dead component.
  useEffect(() => cancelPress, [cancelPress])

  const startPress = useCallback(
    (event: React.PointerEvent, date: string) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return

      firedRef.current = false
      originRef.current = { x: event.clientX, y: event.clientY }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        firedRef.current = true
        if (navigator.vibrate) navigator.vibrate(50)
        onBackdate?.(date)
      }, LONG_PRESS_MS)
    },
    [onBackdate]
  )

  const movePress = useCallback(
    (event: React.PointerEvent) => {
      const origin = originRef.current
      if (!origin) return

      const dx = Math.abs(event.clientX - origin.x)
      const dy = Math.abs(event.clientY - origin.y)
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancelPress()
    },
    [cancelPress]
  )

  const handleClick = useCallback((cell: { date: string; completion: Completion | null }) => {
    if (firedRef.current) {
      firedRef.current = false
      return
    }
    setSelected({ date: cell.date, completion: cell.completion })
  }, [])

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">
          {formatMonth(month ?? today.slice(0, 7))}
        </h3>
        {selected && (
          <p className="text-xs text-zinc-400">
            {formatShortDate(selected.date)} ·{' '}
            {selected.completion ? formatValue(habit, selected.completion) : 'nothing logged'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-[10px] text-zinc-600 text-center pb-1">
            {label}
          </span>
        ))}

        {grid.flat().map((cell) => {
          // Padding days from the neighbouring months are placeholders: they hold the grid's
          // shape and nothing else. Days still to come stay visible but unfilled.
          const blank = cell.isOutside
          // Only a real, unlogged, past day can be backfilled. A logged day is undone from
          // the history list, which is where the timestamp needed to delete it lives.
          const backdatable = !!onBackdate && !blank && !cell.isFuture && !cell.completion

          return (
            <button
              key={cell.date}
              onClick={() => handleClick(cell)}
              {...(backdatable && {
                onPointerDown: (e: React.PointerEvent) => startPress(e, cell.date),
                onPointerMove: movePress,
                onPointerUp: cancelPress,
                onPointerLeave: cancelPress,
                onPointerCancel: cancelPress,
                onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              })}
              aria-label={backdatable ? `${cell.date} — hold to log this day` : cell.date}
              disabled={blank || cell.isFuture}
              style={
                blank || cell.isFuture
                  ? undefined
                  : { backgroundColor: accent.levels[cell.level] }
              }
              className={`no-tap-highlight aspect-square rounded-md text-[10px] transition-opacity ${
                blank
                  ? 'opacity-0 pointer-events-none'
                  : cell.isFuture
                    ? 'text-zinc-600 bg-zinc-900/60'
                    : 'text-zinc-300'
              } ${selected?.date === cell.date ? 'ring-1 ring-zinc-400' : ''} ${
                cell.date === today ? 'ring-1 ring-zinc-500' : ''
              }`}
            >
              {Number(cell.date.slice(-2))}
            </button>
          )
        })}
      </div>

      {onBackdate && <p className="text-[10px] text-zinc-600 mt-2">Hold an empty day to log it</p>}
    </section>
  )
}
