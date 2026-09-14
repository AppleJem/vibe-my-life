import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useTrainingHabits } from '../../hooks/useHabits'
import { sortTrainingHabits, TRAINING_RECENCY_KEY } from '../../utils/climbing'
import { localToday } from '../../utils/recurring'
import type { Habit } from '../../types/habit'

/**
 * The climbing page's training section: a header with a `+`, a horizontally scrollable row
 * of the habits in training, and an arrow into the full training page.
 *
 * The `+` and the arrow land on the same route; the `+` arrives with the Add modal already
 * open via route state, so a refresh on the page itself never re-opens it. Clicking a box
 * is what records recency — it is the signal that this habit is the one being worked on.
 */
export function TrainingSection() {
  const navigate = useNavigate()
  const { training, loading, error } = useTrainingHabits()
  const [recency, setRecency] = useLocalStorage<Record<string, number>>(
    TRAINING_RECENCY_KEY,
    {}
  )

  const today = localToday()
  const ordered = useMemo(
    () => sortTrainingHabits(training, recency, today),
    [training, recency, today]
  )

  const openHabit = (habit: Habit) => {
    setRecency((current) => ({ ...current, [habit.id]: Date.now() }))
    void navigate({ to: '/habits/$habitId', params: { habitId: habit.id } })
  }

  const openTraining = (add: boolean) =>
    void navigate({ to: '/climbing/training', state: add ? { add: true } : undefined })

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Training</h3>

        <button
          onClick={() => openTraining(true)}
          aria-label="Add habits to training"
          className="ml-auto shrink-0 p-1 -mr-1 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

      {loading ? (
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <button
          onClick={() => openTraining(true)}
          className="w-full rounded-xl border border-dashed border-zinc-800 py-4 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
        >
          No habits in training yet — tap + to add some.
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto flex-1 pb-1 -mb-1">
            {ordered.map((habit) => (
              <TrainingBox
                key={habit.id}
                habit={habit}
                isDone={habit.lastCompletedDate === today}
                onClick={() => openHabit(habit)}
              />
            ))}
          </div>

          <button
            onClick={() => openTraining(false)}
            aria-label="All training habits"
            className="shrink-0 p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  )
}

function TrainingBox({
  habit,
  isDone,
  onClick,
}: {
  habit: Habit
  isDone: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-20 shrink-0 rounded-xl border p-2.5 flex flex-col items-center gap-1 transition-colors text-center ${
        isDone
          ? 'bg-zinc-900/60 border-zinc-800/60 hover:bg-zinc-900'
          : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
      }`}
    >
      <span className={`text-2xl ${isDone ? 'opacity-50' : ''}`}>{habit.emoji}</span>
      <span
        className={`w-full truncate text-[11px] leading-tight ${
          isDone ? 'text-zinc-600 line-through' : 'text-zinc-200'
        }`}
      >
        {habit.name}
      </span>

      {isDone && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
