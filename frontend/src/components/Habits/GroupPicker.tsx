import { useState } from 'react'
import { INPUT } from './fieldStyles'
import type { HabitGroup } from '../../types/habit'

interface GroupPickerProps {
  /** The selected group's id, or `null` for ungrouped. */
  value: string | null
  groups: HabitGroup[]
  onChange: (groupId: string | null) => void
  /** Creates the group server-side and resolves with it. */
  onCreate: (name: string) => Promise<HabitGroup>
}

const CHIP = 'rounded-full px-3 py-1.5 text-xs transition-colors border'
const SELECTED = 'bg-zinc-100 text-zinc-900 border-zinc-100'
const IDLE = 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'

/**
 * Pick an existing group, none, or type a new one.
 *
 * A new group is created as soon as its name is committed, before the habit itself is
 * saved — the picker deals in ids, and inventing a placeholder id to reconcile afterwards
 * would be more machinery than the failure it protects against. Abandoning the form
 * therefore leaves an empty group behind, which the list page doesn't render and the group
 * page can delete.
 */
export function GroupPicker({ value, groups, onChange, onCreate }: GroupPickerProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name))

  const commit = async () => {
    const name = (draft ?? '').trim()
    setDraft(null)
    if (!name) return

    // Typing the name of a group that already exists should select it, not make a second
    // one with the same heading.
    const existing = sorted.find((group) => group.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      onChange(existing.id)
      return
    }

    setIsCreating(true)
    try {
      const group = await onCreate(name)
      onChange(group.id)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`${CHIP} ${value === null ? SELECTED : IDLE}`}
        >
          None
        </button>

        {sorted.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onChange(group.id)}
            className={`${CHIP} ${value === group.id ? SELECTED : IDLE}`}
          >
            {group.name}
          </button>
        ))}

        {draft === null && (
          <button
            type="button"
            onClick={() => setDraft('')}
            disabled={isCreating}
            className={`${CHIP} ${IDLE} disabled:opacity-50`}
          >
            {isCreating ? 'Creating…' : '+ New group'}
          </button>
        )}
      </div>

      {draft !== null && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
            if (e.key === 'Escape') setDraft(null)
          }}
          // Same reasoning as the tag field: whatever is typed when focus leaves is what
          // the user meant, so blur commits rather than discards.
          onBlur={() => void commit()}
          placeholder="Rehab exercises"
          autoFocus
          className={`${INPUT} mt-2`}
        />
      )}
    </div>
  )
}
