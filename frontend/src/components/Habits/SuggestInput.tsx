import { useState } from 'react'
import { INPUT } from './fieldStyles'
import { normaliseTag } from '../../utils/habit'

/**
 * A free-text field that suggests what has already been used elsewhere. The vocabulary is
 * derived from the habits already loaded (`useHabitTaxonomy`), so there is nothing to
 * store and nothing to keep in sync — but typing something new is always allowed, which
 * is why this is an input with a dropdown rather than a picker.
 *
 * Groups used to work the same way. They are stored entities with an identity now, so they
 * get a picker of real options instead — see `GroupPicker`.
 */

interface SuggestionsProps {
  items: string[]
  onPick: (item: string) => void
}

/** Shown under the field while it has focus and there is something worth offering. */
function Suggestions({ items, onPick }: SuggestionsProps) {
  if (items.length === 0) return null

  return (
    <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 divide-y divide-zinc-700/60">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            // Fires before blur, so picking with the mouse doesn't race the dropdown
            // closing out from under the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  )
}

const matches = (items: string[], query: string, exclude: string[] = []) => {
  const needle = query.trim().toLowerCase()
  return items
    .filter((item) => !exclude.includes(item))
    .filter((item) => needle === '' || item.toLowerCase().includes(needle))
    .slice(0, 8)
}

interface TagInputProps {
  value: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

/**
 * Tags as removable chips. Everything committed goes through `normaliseTag`, so the same
 * idea typed three ways ends up as one tag rather than three.
 */
export function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  const commit = (raw: string) => {
    const tag = normaliseTag(raw)
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
      return
    }

    // Backspace on an empty field takes back the last chip — the only way to undo a
    // commit without reaching for the ×.
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 pl-2.5 pr-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              #{tag}
              <span aria-hidden className="text-zinc-500">×</span>
            </button>
          ))}
        </div>
      )}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        // Whatever is half-typed when the field loses focus is what the user meant —
        // dropping it because they never pressed Enter would just lose their work.
        onBlur={() => {
          setFocused(false)
          commit(draft)
        }}
        placeholder="morning"
        className={INPUT}
      />

      {focused && (
        <Suggestions items={matches(suggestions, draft, value)} onPick={commit} />
      )}
    </div>
  )
}

