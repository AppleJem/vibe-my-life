import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { HabitForm } from '../../../components/Habits/HabitForm'
import { HabitList } from '../../../components/Habits/HabitList'
import { useHabits } from '../../../hooks/useHabits'
import type { CreateHabitInput } from '../../../types/habit'

export const Route = createFileRoute('/_authenticated/habits/')({
  component: HabitsPage,
})

function HabitsPage() {
  const navigate = useNavigate()
  const { habits, groups, loading, error, createHabit } = useHabits()
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = async (input: CreateHabitInput) => {
    setIsSaving(true)
    try {
      const habit = await createHabit(input)
      setIsCreating(false)
      // Straight into the new habit — the next thing you want is to log it.
      navigate({ to: '/habits/$habitId', params: { habitId: habit.id } })
    } finally {
      setIsSaving(false)
    }
  }

  if (isCreating) {
    return (
      <HabitForm
        habit={null}
        isSaving={isSaving}
        onSave={handleCreate}
        onClose={() => setIsCreating(false)}
      />
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/apps' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Habits</h2>

        <button
          onClick={() => navigate({ to: '/habits/archived' })}
          className="ml-auto text-zinc-400 hover:text-zinc-100 transition-colors p-1 -mr-1"
          aria-label="Archived habits"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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
      ) : habits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-zinc-400">No habits yet</p>
          <p className="text-sm text-zinc-600 mt-1">Add something you want to keep doing.</p>
        </div>
      ) : (
        <HabitList habits={habits} groups={groups} collapseKey="habits:collapsedGroups" />
      )}

      <button
        onClick={() => setIsCreating(true)}
        aria-label="New habit"
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-violet-400 shadow-lg shadow-pink-500/25 flex items-center justify-center text-zinc-950 text-3xl"
      >
        +
      </button>
    </>
  )
}
