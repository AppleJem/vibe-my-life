import { useMemo } from 'react'
import { ACTIVITY_SHADES, buildActivityGrid, formatSessionDate, weekdayOf } from '../../utils/climbing'
import type { ClimbingSession } from '../../types/climbing'

interface ActivityGridProps {
  sessions: ClimbingSession[]
  /** Fired for a day that has one; days with nothing on them aren't tappable. */
  onPickSession: (sessionId: string) => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * The last thirty days as a contribution grid — the picture the app opens on.
 *
 * Shade is climb count, in fixed buckets rather than a scale relative to the window, so a
 * shade means the same thing in March as it did in February. A day with a session but no
 * climbs logged yet still shades at level 1: you were at the wall, and reading the grid as
 * empty for the whole time you're there would be wrong.
 *
 * Leading blanks pad the first row so the columns line up under real weekday labels; the
 * rolling window means the grid starts on a different weekday every day.
 */
export function ActivityGrid({ sessions, onPickSession }: ActivityGridProps) {
  const cells = useMemo(() => buildActivityGrid(sessions), [sessions])
  const leadingBlanks = cells.length > 0 ? weekdayOf(cells[0].date) : 0

  const totalClimbs = cells.reduce((sum, cell) => sum + cell.climbCount, 0)
  const daysOn = cells.filter((cell) => cell.level > 0).length

  return (
    <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">Last 30 days</h3>
        <p className="text-xs text-zinc-500">
          {daysOn} {daysOn === 1 ? 'day' : 'days'} · {totalClimbs}{' '}
          {totalClimbs === 1 ? 'climb' : 'climbs'}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((label, i) => (
          <span key={i} className="text-center text-[10px] text-zinc-600">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}

        {cells.map((cell) => {
          const climbable = cell.sessionIds.length > 0
          const label = `${formatSessionDate(cell.date)}: ${
            climbable ? `${cell.climbCount} climbs` : 'no session'
          }`

          return (
            <button
              key={cell.date}
              type="button"
              disabled={!climbable}
              onClick={() => onPickSession(cell.sessionIds[0])}
              title={label}
              aria-label={label}
              className={`aspect-square rounded-md transition-transform ${
                ACTIVITY_SHADES[cell.level]
              } ${climbable ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-zinc-600">
        <span>Less</span>
        {ACTIVITY_SHADES.map((shade, i) => (
          <span key={i} className={`w-2.5 h-2.5 rounded-sm ${shade}`} />
        ))}
        <span>More</span>
      </div>
    </section>
  )
}
