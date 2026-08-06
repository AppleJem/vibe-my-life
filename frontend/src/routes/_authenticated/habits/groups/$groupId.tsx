import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { SortableList } from '../../../../components/Habits/SortableList'
import { INPUT } from '../../../../components/Habits/fieldStyles'
import { useHabitGroups, useHabits } from '../../../../hooks/useHabits'
import { orderMembers } from '../../../../utils/habit'
import type { Habit } from '../../../../types/habit'

export const Route = createFileRoute('/_authenticated/habits/groups/$groupId')({
  component: HabitGroupPage,
})

/**
 * One group: rename it, drag its habits into the order the list page shows them in, or
 * delete it.
 *
 * Nothing is fetched here. `useHabits()` reads the same list query the habits page already
 * warmed, and the members are picked out of it — a page that loaded its own habits would be
 * one request per group over data that was already in hand.
 */
function HabitGroupPage() {
  const { groupId } = Route.useParams()
  const navigate = useNavigate()

  const { habits, loading } = useHabits()
  const { groups, updateGroup, deleteGroup } = useHabitGroups()

  const group = groups.find((candidate) => candidate.id === groupId) ?? null

  const members = useMemo(
    () =>
      group
        ? orderMembers(habits.filter((habit) => habit.groupId === group.id), group.habitIds)
        : [],
    [habits, group]
  )

  const [name, setName] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const back = () => navigate({ to: '/habits' })

  const commitName = async () => {
    const next = (name ?? '').trim()
    setName(null)
    if (!group || !next || next === group.name) return
    await updateGroup({ id: group.id, input: { name: next } })
  }

  const handleReorder = (reordered: Habit[]) => {
    if (!group) return
    void updateGroup({ id: group.id, input: { habitIds: reordered.map((habit) => habit.id) } })
  }

  const handleDelete = async () => {
    if (!group) return

    setIsDeleting(true)
    try {
      await deleteGroup(group.id)
      back()
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return <div className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
  }

  if (!group) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">This group no longer exists.</p>
        <button onClick={back} style={{ color: '#ec4899' }} className="text-sm mt-2">
          Back to habits
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={back}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {name === null ? (
          <button
            onClick={() => setName(group.name)}
            className="text-lg font-semibold text-zinc-100 text-left"
          >
            {group.name}
          </button>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commitName()
              }
              if (e.key === 'Escape') setName(null)
            }}
            onBlur={() => void commitName()}
            autoFocus
            className={INPUT}
          />
        )}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400">Nothing in this group yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Add habits to it from the habit’s own edit screen.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600 mb-3">
            Drag the handles to set the order habits appear in on the list.
          </p>

          <SortableList items={members} keyOf={(habit) => habit.id} onReorder={handleReorder}>
            {(habit) => (
              <div className="flex items-center gap-3 h-full bg-zinc-900 rounded-xl px-4">
                <span className="text-2xl w-9 shrink-0 text-center">{habit.emoji}</span>
                <p className="text-zinc-100 truncate">{habit.name}</p>
              </div>
            )}
          </SortableList>
        </>
      )}

      <button
        onClick={() => setConfirmDelete(true)}
        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-red-400 hover:bg-zinc-800 mt-8"
      >
        Delete group
      </button>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this group?"
        message="The habits in it are kept, along with all their history — they just stop being grouped."
        isConfirming={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
