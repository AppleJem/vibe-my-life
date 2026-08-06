import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HabitForm } from '../../../components/Habits/HabitForm'
import { MAX_DAYS, WeekStrip } from '../../../components/Habits/WeekStrip'
import { useHabits, useRecentCompletions } from '../../../hooks/useHabits'
import { groupHabits } from '../../../utils/habit'
import { localToday } from '../../../utils/recurring'
import type { Completion, CreateHabitInput, Habit } from '../../../types/habit'

export const Route = createFileRoute('/_authenticated/habits/')({
  component: HabitsPage,
})

/** Stands in for a group id in the collapsed set — no real group owns these habits. */
const UNGROUPED_KEY = 'ungrouped'

function HabitsPage() {
  const navigate = useNavigate()
  const { habits, groups, loading, error, createHabit } = useHabits()
  // The strip can stretch to `MAX_DAYS` boxes on a wide window, so fetch that far back.
  const { byHabit } = useRecentCompletions(MAX_DAYS)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const today = localToday()
  const sections = useMemo(() => groupHabits(habits, groups), [habits, groups])

  const toggleCollapsed = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })

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
        <div className="space-y-6">
          {sections.map(({ group, members }) => {
            const key = group?.id ?? UNGROUPED_KEY
            const isCollapsed = collapsed.has(key)

            return (
              <section key={key}>
                <div className="flex items-center gap-2 mb-2">
                  {group ? (
                    // The header is its own tap target, separate from the rows beneath it —
                    // tapping the group opens it, tapping a habit opens the habit.
                    <button
                      onClick={() =>
                        navigate({ to: '/habits/groups/$groupId', params: { groupId: group.id } })
                      }
                      className="flex items-center gap-1 min-w-0 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <span className="truncate">{group.name}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    // The ungrouped remainder has no page to open, so its heading is plain text.
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Ungrouped
                    </span>
                  )}

                  <button
                    onClick={() => toggleCollapsed(key)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group?.name ?? 'Ungrouped'}`}
                    className="ml-auto shrink-0 p-1 -mr-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* `0fr`→`1fr` collapses to the rows' own height without measuring it, so the
                    section animates shut whatever it contains. */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-2">
                      {members.map((habit) => (
                        <HabitRow
                          key={habit.id}
                          habit={habit}
                          completions={byHabit.get(habit.id) ?? []}
                          today={today}
                          onClick={() =>
                            navigate({ to: '/habits/$habitId', params: { habitId: habit.id } })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
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

interface HabitRowProps {
  habit: Habit
  /** This habit's slice of the shared recent-history fetch. */
  completions: Completion[]
  today: string
  onClick: () => void
}

function HabitRow({ habit, completions, today, onClick }: HabitRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-zinc-900 rounded-xl px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
    >
      <span className="text-2xl w-9 shrink-0 text-center">{habit.emoji}</span>
      {/* `min-w-0` so the name truncates instead of pushing the column wider — the strip
          sizes itself to whatever this column ends up being. */}
      <div className="flex-1 min-w-0 flex flex-col items-stretch gap-1.5">
        <p className="text-zinc-100 truncate">{habit.name}</p>
        <WeekStrip habit={habit} completions={completions} today={today} />
      </div>
    </button>
  )
}
