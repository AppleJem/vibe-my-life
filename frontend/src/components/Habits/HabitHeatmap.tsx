import { useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import { buildHeatmap, formatShortDate, formatValue } from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface HabitHeatmapProps {
  habit: Habit
  completions: Completion[]
  today: string
  weeks?: number
}

/** Only every other row is labelled, or the labels crowd the 12px cells. */
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export function HabitHeatmap({ habit, completions, today, weeks = 26 }: HabitHeatmapProps) {
  const accent = accentOf(habit.color)
  const grid = buildHeatmap(habit, completions, today, weeks)
  const [selected, setSelected] = useState<{ date: string; completion: Completion | null } | null>(
    null
  )

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">Last {weeks} weeks</h3>
        {selected && (
          <p className="text-xs text-zinc-400">
            {formatShortDate(selected.date)} ·{' '}
            {selected.completion ? formatValue(habit, selected.completion) : 'nothing logged'}
          </p>
        )}
      </div>

      {/* Columns are weeks, so on a narrow phone this scrolls sideways rather than
          squeezing the cells into invisibility. */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 w-max">
          <div className="flex flex-col gap-1 pr-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="h-3 text-[9px] leading-3 text-zinc-600 w-6 text-right">
                {label}
              </span>
            ))}
          </div>

          {grid.map((week, w) => (
            <div key={w} className="flex flex-col gap-1">
              {week.map((cell) => (
                <button
                  key={cell.date}
                  onClick={() =>
                    setSelected({ date: cell.date, completion: cell.completion })
                  }
                  aria-label={cell.date}
                  style={cell.isFuture ? undefined : { backgroundColor: accent.levels[cell.level] }}
                  className={`w-3 h-3 rounded-sm transition-opacity ${
                    cell.isFuture ? 'opacity-0 pointer-events-none' : ''
                  } ${
                    selected?.date === cell.date ? 'ring-1 ring-zinc-400' : ''
                  } ${cell.date === today ? 'ring-1 ring-zinc-500' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
