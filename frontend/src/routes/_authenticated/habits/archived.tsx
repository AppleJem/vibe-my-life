import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HabitList } from '../../../components/Habits/HabitList'
import { useArchivedHabits } from '../../../hooks/useHabits'

export const Route = createFileRoute('/_authenticated/habits/archived')({
  component: ArchivedHabitsPage,
})

function ArchivedHabitsPage() {
  const navigate = useNavigate()
  const { habits, groups, loading, error } = useArchivedHabits()

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/habits' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Archived</h2>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : habits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-zinc-400">No archived habits</p>
          <p className="text-sm text-zinc-600 mt-1">Habits you archive land here, history intact.</p>
        </div>
      ) : (
        <HabitList habits={habits} groups={groups} collapseKey="habits:archivedCollapsedGroups" />
      )}
    </>
  )
}
