import { useState } from 'react'
import { INPUT } from './fieldStyles'

interface LocationInputProps {
  value: string
  /** Where you've climbed before, most recent first. */
  suggestions: string[]
  onChange: (location: string) => void
  autoFocus?: boolean
}

/**
 * A free-text location that suggests the places already climbed at.
 *
 * The vocabulary comes from the sessions already loaded (`useKnownLocations`), so there is
 * nothing to store and nothing to keep in sync — and typing somewhere new is always
 * allowed, which is why this is an input with a dropdown rather than a picker. Adapted
 * from `Habits/SuggestInput`, minus the chips: a session happens in one place.
 */
export function LocationInput({ value, suggestions, onChange, autoFocus }: LocationInputProps) {
  const [focused, setFocused] = useState(false)

  const needle = value.trim().toLowerCase()
  const matches = suggestions
    .filter((item) => needle === '' || item.toLowerCase().includes(needle))
    // An exact match is already in the field; offering it is a row that does nothing.
    .filter((item) => item.toLowerCase() !== needle)
    .slice(0, 8)

  return (
    <div>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        // The typed text is already committed on every keystroke, so blur only closes the
        // dropdown — a half-typed gym name is never thrown away.
        onBlur={() => setFocused(false)}
        placeholder="Where did you climb?"
        className={INPUT}
      />

      {focused && matches.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 divide-y divide-zinc-700/60">
          {matches.map((item) => (
            <li key={item}>
              <button
                type="button"
                // Fires before blur, so picking with the mouse doesn't race the dropdown
                // closing out from under the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item)
                  setFocused(false)
                }}
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
