import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { SLIP_COLOR, accentOf } from '../../constants/habitColors'
import {
  addMonths,
  buildMonthHeatmap,
  formatMonth,
  formatShortDate,
  formatValue,
  polarityOf,
  startDateOf,
} from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface HabitHeatmapProps {
  habit: Habit
  completions: Completion[]
  today: string
  /** `YYYY-MM`. The month shown first; defaults to the month `today` falls in. */
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
  const isAvoid = polarityOf(habit) === 'avoid'
  const [shownMonth, setShownMonth] = useState(month ?? today.slice(0, 7))
  const grid = buildMonthHeatmap(habit, completions, today, shownMonth)
  const [selected, setSelected] = useState<{ date: string; completion: Completion | null } | null>(
    null
  )

  // Nothing to see past today, and nothing before the habit existed — the arrows stop at
  // both ends rather than paging through empty grids. An early completion (a backfill from
  // before the start date) still counts as history worth reaching.
  const latestMonth = today.slice(0, 7)
  const earliestMonth = useMemo(() => {
    const dates = completions.map((c) => c.date).concat(startDateOf(habit))
    return dates.reduce((min, date) => (date < min ? date : min)).slice(0, 7)
  }, [completions, habit])

  const canGoBack = shownMonth > earliestMonth
  const canGoForward = shownMonth < latestMonth

  // The caption names a day in the month being left, so it goes with the month.
  const step = (delta: number) => {
    setSelected(null)
    setShownMonth((current) => addMonths(current, delta))
  }

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
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <MonthArrow
            direction="prev"
            disabled={!canGoBack}
            onClick={() => step(-1)}
          />
          <h3 className="text-sm font-semibold text-zinc-100 min-w-[7.5rem] text-center">
            {formatMonth(shownMonth)}
          </h3>
          <MonthArrow
            direction="next"
            disabled={!canGoForward}
            onClick={() => step(1)}
          />
        </div>
        {selected && (
          <p className="text-xs text-zinc-400 text-right">
            {formatShortDate(selected.date)} ·{' '}
            {selected.completion
              ? formatValue(habit, selected.completion)
              : isAvoid
                ? selected.date < startDateOf(habit)
                  ? 'before you started'
                  : 'clean'
                : 'nothing logged'}
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
          // the history list, which is where the timestamp needed to delete it lives. Days
          // before an avoid habit's start date were never being measured, so there is
          // nothing to record on them either.
          const backdatable =
            !!onBackdate && !blank && !cell.isFuture && !cell.completion && !cell.isBeforeStart
          // Slips take the failure colour rather than a shade of the accent; days outside
          // the measured window stay as unfilled as a day with nothing on it.
          const background = cell.isSlip ? SLIP_COLOR : accent.levels[cell.level]

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
              aria-label={
                backdatable
                  ? `${cell.date} — hold to ${isAvoid ? 'mark a slip on' : 'log'} this day`
                  : cell.date
              }
              disabled={blank || cell.isFuture}
              style={blank || cell.isFuture ? undefined : { backgroundColor: background }}
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

      {onBackdate && (
        <p className="text-[10px] text-zinc-600 mt-2">
          {isAvoid ? 'Hold a clean day to mark a slip' : 'Hold an empty day to log it'}
        </p>
      )}
    </section>
  )
}

/** The month steppers either side of the heading. */
function MonthArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous month' : 'Next month'}
      className="no-tap-highlight p-1 text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-25 disabled:hover:text-zinc-400"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  )
}
