import { useMemo } from 'react'
import {
  ACTIVITY_COLUMNS,
  BOTH_SHADES,
  CLIMB_SHADES,
  TRAINING_SHADES,
  activityShade,
  buildActivityGrid,
  formatSessionDate,
} from '../../utils/climbing'
import type { ClimbingSession } from '../../types/climbing'

interface ActivityGridProps {
  sessions: ClimbingSession[]
  /** Training completions per local date — see `useTrainingActivity`. */
  trainingByDate: ReadonlyMap<string, number>
  /** Fired for a day that has one; days with nothing on them aren't tappable. */
  onPickSession: (sessionId: string) => void
}

/** Full weekday names for the row labels. */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * A contribution grid — the picture the app opens on.
 *
 * Two things shape a square: `kind`, which picks the hue (blue for climbing, green for
 * training, fuchsia for both), and `level`, which sets how dark it goes. Both counts are
 * graded on their own buckets and summed, so a both-day reads as the climb and the training
 * together. A day with a session but no climbs logged yet still shades at least level 1:
 * you were at the wall, and reading the grid as empty for the whole time you're there
 * would be wrong.
 *
 * Layout: 7 rows (Sun–Sat) × 16 columns (weeks), with the weekday label leading each row.
 * The grid always starts on a Sunday and each column is a full week, so the day-of-week
 * labels stay consistent.
 *
 * Rendered row by row rather than as a label column beside a grid of columns. It used to be
 * the latter, with the labels held at a fixed 18px while the squares derived their height
 * from their width — so the two only lined up when the square happened to be 18px, and
 * drifted everywhere else. A label and its squares sharing one flex row are aligned by the
 * row itself, at any width, with no pixel height to keep in sync.
 */
export function ActivityGrid({ sessions, trainingByDate, onPickSession }: ActivityGridProps) {
  const cells = useMemo(
    () => buildActivityGrid(sessions, trainingByDate, ACTIVITY_COLUMNS),
    [sessions, trainingByDate]
  )

  const totalClimbs = cells.reduce((sum, cell) => sum + cell.climbCount, 0)
  const totalTraining = cells.reduce((sum, cell) => sum + cell.trainingCount, 0)
  const daysOn = cells.filter((cell) => cell.level > 0).length

  // Group cells by week (column). Each week has 7 consecutive days, Sun–Sat.
  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">Last {ACTIVITY_COLUMNS} weeks</h3>
        <p className="text-xs text-zinc-500">
          {daysOn} {daysOn === 1 ? 'day' : 'days'} · {totalClimbs}{' '}
          {totalClimbs === 1 ? 'climb' : 'climbs'} · {totalTraining} training
        </p>
      </div>

      {/* One row per weekday: the label and its squares are siblings, so `items-center`
          keeps them level without either side knowing the other's height. */}
      <div className="flex flex-col gap-1.5">
        {WEEKDAY_LABELS.map((weekdayLabel, weekday) => (
          <div key={weekdayLabel} className="flex items-center gap-1.5">
            {/* `leading-none` so the text can't set the row height — the square should. */}
            <span className="w-7 shrink-0 text-[10px] leading-none text-zinc-600">
              {weekdayLabel}
            </span>

            <div className="flex flex-1 gap-1.5">
              {weeks.map((week) => {
                const cell = week[weekday]
                const climbable = cell.sessionIds.length > 0

                const parts: string[] = []
                if (cell.climbCount > 0) {
                  parts.push(`${cell.climbCount} ${cell.climbCount === 1 ? 'climb' : 'climbs'}`)
                }
                if (cell.trainingCount > 0) {
                  parts.push(
                    `${cell.trainingCount} training${cell.trainingCount === 1 ? '' : 's'}`
                  )
                }
                const label = `${formatSessionDate(cell.date)}: ${
                  parts.length > 0 ? parts.join(', ') : 'no activity'
                }`

                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!climbable}
                    onClick={() => onPickSession(cell.sessionIds[0])}
                    title={label}
                    aria-label={label}
                    className={`aspect-square flex-1 rounded-[4px] transition-transform ${activityShade(
                      cell.kind,
                      cell.level
                    )} ${climbable ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 mt-3 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm ${CLIMB_SHADES[3]}`} />
          Climb
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm ${TRAINING_SHADES[3]}`} />
          Training
        </span>
        <span className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm ${BOTH_SHADES[3]}`} />
          Both
        </span>
        <span className="text-zinc-700">· darker = more</span>
      </div>
    </section>
  )
}
