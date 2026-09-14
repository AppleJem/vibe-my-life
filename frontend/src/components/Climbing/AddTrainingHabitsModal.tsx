import { useEffect, useState } from 'react'
import { HabitList } from '../Habits/HabitList'
import { useTrainingHabits } from '../../hooks/useHabits'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { TRAINING_RECENCY_KEY } from '../../utils/climbing'
import type { Habit } from '../../types/habit'

/**
 * The training picker. A draft over the whole build-habit population: rows are checked when
 * the habit is already in training, tapping toggles, and Confirm is what writes — so
 * opening the modal and backing out changes nothing.
 *
 * The list itself is the habits page's `HabitList` in selection mode, grouped and
 * collapsible the same way, so the picker reads as a familiar list rather than a new one.
 *
 * The component is mounted only while open, so a fresh mount is what seeds the draft.
 * Seeding waits for the shared list to arrive — starting from an empty set would make
 * Confirm look like "remove everything".
 */
export function AddTrainingHabitsModal({ onClose }: { onClose: () => void }) {
  const { habits, groups, training, loading, applyTraining, saving } = useTrainingHabits()
  const [recency, setRecency] = useLocalStorage<Record<string, number>>(
    TRAINING_RECENCY_KEY,
    {}
  )

  /** `null` until the list arrives, so the draft is never seeded from nothing. */
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && selected === null) {
      setSelected(new Set(training.map((habit) => habit.id)))
    }
  }, [loading, selected, training])

  const toggle = (habit: Habit) => {
    setSelected((current) => {
      const next = new Set(current ?? [])
      if (next.has(habit.id)) next.delete(habit.id)
      else next.add(habit.id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (!selected) return
    setError(null)

    const removed = training
      .filter((habit) => !selected.has(habit.id))
      .map((habit) => habit.id)

    try {
      await applyTraining(selected)

      // A removed habit's recency is meaningless — drop it so re-adding starts fresh.
      if (removed.length > 0) {
        const next = { ...recency }
        for (const id of removed) delete next[id]
        setRecency(next)
      }

      onClose()
    } catch {
      setError('Could not save your changes. Try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add habits to training"
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-zinc-950 border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <h2 className="flex-1 text-lg font-semibold text-zinc-100">Add to training</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -mr-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

          {loading || selected === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400">No habits to add</p>
              <p className="text-sm text-zinc-600 mt-1">
                Create a habit first, then it can join the training.
              </p>
            </div>
          ) : (
            <HabitList
              habits={habits}
              groups={groups}
              collapseKey="climbing:addHabits:collapsedGroups"
              selection={{ selectedIds: selected, onToggle: toggle }}
            />
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={saving || selected === null}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-zinc-950 bg-gradient-to-r from-sky-400 to-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
