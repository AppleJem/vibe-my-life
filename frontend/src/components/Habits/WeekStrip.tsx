import { useLayoutEffect, useRef, useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import { addDays, formatShortDate, formatValue, intensityScale, levelFor } from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface WeekStripProps {
  habit: Habit
  /** Only needs to cover the window; anything older is ignored. */
  completions: Completion[]
  today: string
}

/** Box and gap in px — these must match the `w-4 h-4` / `gap-1` classes below. */
const BOX = 16
const GAP = 4

/** What the strip shows before it has been measured, and the floor if the row is tiny. */
const MIN_DAYS = 7

/**
 * The cap on how far back the strip will reach. It is also how much history the list page
 * fetches (`useRecentCompletions(MAX_DAYS)`) — asking for more boxes than that would draw
 * days as empty that simply hadn't been loaded.
 */
export const MAX_DAYS = 30

/**
 * Recent days as fixed-size boxes, oldest on the left and today on the right — the list
 * row's whole completion signal, in place of the single done-today dot it replaced.
 *
 * How many days show is whatever fits the row: the boxes stay `BOX` px so they read the
 * same on every habit, and the count grows with the space instead. That means a phone shows
 * a week or so and a wide window shows a month, off one measurement per row.
 *
 * Shading reuses the heatmap's 0–4 levels so a half-done day reads as half-done, but the
 * scale is taken from the days on screen rather than all history: grading a partial window
 * against a personal best the strip never shows would leave every box looking faint.
 */
export function WeekStrip({ habit, completions, today }: WeekStripProps) {
  const accent = accentOf(habit.color)
  const ref = useRef<HTMLDivElement>(null)
  const [days, setDays] = useState(MIN_DAYS)

  // Measured rather than driven by a breakpoint: the row's width depends on the emoji, the
  // page padding and the viewport, and only the element itself knows the answer.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      // n boxes and n-1 gaps fit in `width`.
      const fits = Math.floor((width + GAP) / (BOX + GAP))
      setDays(Math.min(MAX_DAYS, Math.max(MIN_DAYS, fits)))
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))

  const byDate = new Map(completions.map((completion) => [completion.date, completion]))
  const window = dates.map((date) => byDate.get(date)).filter((c) => c !== undefined)
  const scale = intensityScale(habit, window)

  return (
    // `justify-end` keeps today pinned to the right edge, so the leftover sliver of space —
    // whatever didn't add up to another box — falls on the old end where it reads as margin.
    // `overflow-hidden` stops a stale count from widening the row before the next measure.
    <div
      ref={ref}
      className="flex gap-1 w-full justify-center overflow-hidden px-0.5"
      role="group"
      aria-label={`Past ${days} days`}
    >
      {dates.map((date) => {
        const completion = byDate.get(date) ?? null

        return (
          <span
            key={date}
            aria-label={`${formatShortDate(date)}: ${completion ? formatValue(habit, completion) : 'nothing logged'
              }`}
            style={{ backgroundColor: accent.levels[levelFor(completion, scale)] }}
            className={`w-4 h-4 shrink-0 rounded-sm ${date === today ? 'ring-1 ring-zinc-500' : ''}`}
          />
        )
      })}
    </div>
  )
}
