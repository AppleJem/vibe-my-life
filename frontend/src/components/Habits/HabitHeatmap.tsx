import { useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import { buildMonthHeatmap, formatMonth, formatShortDate, formatValue } from '../../utils/habit'
import type { Completion, Habit } from '../../types/habit'

interface HabitHeatmapProps {
  habit: Habit
  completions: Completion[]
  today: string
  /** `YYYY-MM`. Defaults to the month `today` falls in. */
  month?: string
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function HabitHeatmap({ habit, completions, today, month }: HabitHeatmapProps) {
  const accent = accentOf(habit.color)
  const grid = buildMonthHeatmap(habit, completions, today, month)
  const [selected, setSelected] = useState<{ date: string; completion: Completion | null } | null>(
    null
  )

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

          return (
            <button
              key={cell.date}
              onClick={() => setSelected({ date: cell.date, completion: cell.completion })}
              aria-label={cell.date}
              disabled={blank || cell.isFuture}
              style={
                blank || cell.isFuture
                  ? undefined
                  : { backgroundColor: accent.levels[cell.level] }
              }
              className={`aspect-square rounded-md text-[10px] transition-opacity ${
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
    </section>
  )
}
