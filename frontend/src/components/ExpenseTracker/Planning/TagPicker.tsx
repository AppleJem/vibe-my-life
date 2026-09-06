import { useState } from 'react'
import { INPUT } from '../../Habits/fieldStyles'

interface TagPickerProps {
  /** The normalized tag, or `''` for untagged. */
  value: string
  /** Tags already in use, alphabetical. */
  tags: string[]
  onChange: (tag: string) => void
}

const CHIP = 'rounded-full px-3 py-1.5 text-xs transition-colors border capitalize'
const SELECTED = 'bg-zinc-100 text-zinc-900 border-zinc-100'
const IDLE = 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'

/**
 * Normalises the same way the server does, so the chip a user just typed matches the one
 * that comes back and the two don't briefly render as different tags.
 */
const normalize = (tag: string) => tag.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Pick an existing tag, none, or type a new one. Modelled on `Habits/GroupPicker`, minus
 * the server round-trip — a tag is just a string on the holding, so there is nothing to
 * create ahead of the save and nothing left behind if the form is abandoned.
 */
export function TagPicker({ value, tags, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const tag = normalize(draft ?? '')
    setDraft(null)
    if (tag) onChange(tag)
  }

  // A tag typed in this session isn't in `tags` yet — it comes from the saved holdings —
  // so the current value is folded in to keep its chip on screen and selected.
  const options = value && !tags.includes(value) ? [...tags, value].sort() : tags

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`${CHIP} ${value === '' ? SELECTED : IDLE}`}
        >
          None
        </button>

        {options.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(tag)}
            className={`${CHIP} ${value === tag ? SELECTED : IDLE}`}
          >
            {tag}
          </button>
        ))}

        {draft === null && (
          <button
            type="button"
            onClick={() => setDraft('')}
            className={`${CHIP} ${IDLE}`}
          >
            + New tag
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
              commit()
            }
            if (e.key === 'Escape') setDraft(null)
          }}
          // Whatever is typed when focus leaves is what the user meant, so blur commits
          // rather than discards — the same call `GroupPicker` makes.
          onBlur={commit}
          placeholder="fixed deposit"
          autoFocus
          className={`${INPUT} mt-2`}
        />
      )}
    </div>
  )
}
