import { accentOf } from '../../constants/habitColors'
import { addDays, formatShortDate, formatValue, intensityScale, levelFor } from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface WeekStripProps {
  habit: Habit
  /** Only needs to cover the window; anything older is ignored. */
  completions: Completion[]
  today: string
}

const DAYS = 7

/**
 * The past week as seven boxes, oldest on the left and today on the right — the list
 * row's whole completion signal, in place of the single done-today dot it replaced.
 *
 * Shading reuses the heatmap's 0–4 levels so a half-done day reads as half-done, but the
 * scale is taken from these seven days rather than all history: grading a partial week
 * against a personal best the strip never shows would leave every box looking faint.
 */
export function WeekStrip({ habit, completions, today }: WeekStripProps) {
  const accent = accentOf(habit.color)
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i - (DAYS - 1)))

  const byDate = new Map(completions.map((completion) => [completion.date, completion]))
  const window = dates.map((date) => byDate.get(date)).filter((c) => c !== undefined)
  const scale = intensityScale(habit, window)

  return (
    <div className="flex gap-1 shrink-0" role="group" aria-label="Past 7 days">
      {dates.map((date) => {
        const completion = byDate.get(date) ?? null

        return (
          <span
            key={date}
            aria-label={`${formatShortDate(date)}: ${
              completion ? formatValue(habit, completion) : 'nothing logged'
            }`}
            style={{ backgroundColor: accent.levels[levelFor(completion, scale)] }}
            className={`w-4 h-4 rounded-sm ${date === today ? 'ring-1 ring-zinc-500' : ''}`}
          />
        )
      })}
    </div>
  )
}
