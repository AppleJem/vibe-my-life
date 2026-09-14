import { useEffect, useState } from 'react'
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { AddTrainingHabitsModal } from '../../../components/Climbing/AddTrainingHabitsModal'
import { HabitList } from '../../../components/Habits/HabitList'
import { useTrainingHabits } from '../../../hooks/useHabits'

declare module '@tanstack/history' {
  interface HistoryState {
    /** Opens the Add modal on arrival, set by the strip's `+`. Never persisted. */
    add?: boolean
  }
}

export const Route = createFileRoute('/_authenticated/climbing/training')({
  component: TrainingPage,
})

/**
 * The full training list: the habits in training, grouped and collapsible exactly as on the
 * habits page — the strip's "see all". Tapping a row opens the habit; membership is edited
 * through the Add modal, which the `+` here and the strip's `+` both open.
 *
 * The strip's `+` arrives with `state.add` set so the modal is already up. That state is
 * cleared immediately with a `replace`, so refreshing the page lands on the plain list and
 * the browser's back button does not re-open the modal.
 */
function TrainingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { training, groups, loading, error } = useTrainingHabits()
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (!location.state?.add) return
    setIsAdding(true)
    void navigate({ to: '/climbing/training', replace: true, state: {} })
  }, [location.state?.add, navigate])

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/climbing' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="flex-1 text-lg font-semibold text-zinc-100">Training</h2>

        <button
          onClick={() => setIsAdding(true)}
          aria-label="Add habits to training"
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -mr-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : training.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏋️</p>
          <p className="text-zinc-400">Nothing in training yet</p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-3 text-sm text-sky-400 hover:text-sky-300 transition-colors"
          >
            Add some habits
          </button>
        </div>
      ) : (
        <HabitList
          habits={training}
          groups={groups}
          collapseKey="climbing:training:collapsedGroups"
        />
      )}

      {isAdding && <AddTrainingHabitsModal onClose={() => setIsAdding(false)} />}
    </>
  )
}
