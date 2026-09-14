import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { MAX_DAYS, WeekStrip } from './WeekStrip'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { useRecentCompletions } from '../../hooks/useHabits'
import { groupHabits } from '../../utils/habit'
import { localToday } from '../../utils/recurring'
import type { Completion, Habit, HabitGroup } from '../../types/habit'

/** Stands in for a group id in the collapsed set — no real group owns these habits. */
const UNGROUPED_KEY = 'ungrouped'

interface HabitListProps {
  habits: Habit[]
  groups: HabitGroup[]
  /** localStorage key for the collapse set — each page keeps its own. */
  collapseKey: string
  /**
   * When provided, the list becomes a picker: rows toggle instead of navigating and carry
   * a checkbox. `selectedIds` is the draft set the caller owns; the list never writes it.
   * Absent (the habits and archived pages) leaves the default navigate-on-tap behaviour.
   */
  selection?: {
    selectedIds: ReadonlySet<string>
    onToggle: (habit: Habit) => void
  }
}

/**
 * The grouped, collapsible habit list. Shared by the habits page and the archived page,
 * which differ only in which slice of the list query they hand over — and by the training
 * Add modal, which uses it in selection mode.
 */
export function HabitList({ habits, groups, collapseKey, selection }: HabitListProps) {
  const navigate = useNavigate()
  // The strip can stretch to `MAX_DAYS` boxes on a wide window, so fetch that far back.
  const { byHabit } = useRecentCompletions(MAX_DAYS)
  const [collapsed, setCollapsed] = useLocalStorage<string[]>(collapseKey, [])
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed])

  const today = localToday()
  const sections = useMemo(() => groupHabits(habits, groups), [habits, groups])

  const toggleCollapsed = (key: string) =>
    setCollapsed((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    )

  return (
    <div className="space-y-6">
      {sections.map(({ group, members }) => {
        const key = group?.id ?? UNGROUPED_KEY
        const isCollapsed = collapsedSet.has(key)

        return (
          <section key={key}>
            <div className="flex items-center gap-2 mb-2">
              {group ? (
                // In selection mode the name is inert — navigating to the group page would
                // unmount the modal and throw away the draft. Selecting habits is the task.
                selection ? (
                  <span className="truncate text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {group.name}
                  </span>
                ) : (
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
                )
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
                      selected={selection ? selection.selectedIds.has(habit.id) : undefined}
                      onClick={() =>
                        selection
                          ? selection.onToggle(habit)
                          : navigate({ to: '/habits/$habitId', params: { habitId: habit.id } })
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
  )
}

interface HabitRowProps {
  habit: Habit
  /** This habit's slice of the shared recent-history fetch. */
  completions: Completion[]
  today: string
  onClick: () => void
  /** `undefined` outside selection mode; a boolean inside it. */
  selected?: boolean
}

function HabitRow({ habit, completions, today, onClick, selected }: HabitRowProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-left ${
        selected ? 'bg-zinc-800' : 'bg-zinc-900 hover:bg-zinc-800'
      }`}
    >
      <span className="text-2xl w-9 shrink-0 text-center">{habit.emoji}</span>
      {/* `min-w-0` so the name truncates instead of pushing the column wider — the strip
          sizes itself to whatever this column ends up being. */}
      <div className="flex-1 min-w-0 flex flex-col items-stretch gap-1.5">
        <p className="text-zinc-100 truncate">{habit.name}</p>
        <WeekStrip habit={habit} completions={completions} today={today} />
      </div>

      {selected !== undefined && (
        <span
          className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
            selected ? 'bg-sky-500 border-sky-500 text-zinc-950' : 'border-zinc-600'
          }`}
        >
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      )}
    </button>
  )
}
