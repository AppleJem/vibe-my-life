import { useState } from 'react'
import { GRADE_SYSTEMS } from '../../utils/climbing'
import { INPUT } from './fieldStyles'
import type { GradeKind } from '../../types/climbing'

interface GradeSystemPickerProps {
  system: string
  kind: GradeKind
  onSystemChange: (system: string) => void
  onKindChange: (kind: GradeKind) => void
}

const CUSTOM = '__custom__'

const KINDS: { value: GradeKind; label: string }[] = [
  { value: 'integer', label: '123' },
  { value: 'string', label: 'abc' },
]

/**
 * The grade scale this session was climbed on, and how its grades are typed.
 *
 * Both live on the session rather than the app, because the answer changes the moment you
 * climb somewhere else — a trip to a gym on Font grades shouldn't rewrite what every
 * previous session meant. A new session inherits whatever the last one used, so the common
 * case still costs nothing.
 *
 * The kind toggle only picks the editor: grades are stored as text either way, so flipping
 * it never touches what's already logged.
 */
export function GradeSystemPicker({
  system,
  kind,
  onSystemChange,
  onKindChange,
}: GradeSystemPickerProps) {
  const known = (GRADE_SYSTEMS as readonly string[]).includes(system)
  // Sticky once chosen, so clearing the custom field doesn't snap the select back to V.
  const [custom, setCustom] = useState(!known)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        {custom ? (
          <input
            type="text"
            value={system}
            autoFocus
            onChange={(e) => onSystemChange(e.target.value)}
            placeholder="Grade system"
            className={INPUT}
          />
        ) : (
          <select
            value={system}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustom(true)
                onSystemChange('')
              } else {
                onSystemChange(e.target.value)
              }
            }}
            className={INPUT}
          >
            {GRADE_SYSTEMS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={CUSTOM}>Custom…</option>
          </select>
        )}
      </div>

      {custom && (
        <button
          type="button"
          onClick={() => {
            setCustom(false)
            onSystemChange(GRADE_SYSTEMS[0])
          }}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300 px-1"
        >
          List
        </button>
      )}

      <div className="shrink-0 flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1">
        {KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onKindChange(option.value)}
            aria-pressed={kind === option.value}
            title={
              option.value === 'integer'
                ? 'Grades are numbers, stepped with − and +'
                : 'Grades are short text, typed'
            }
            className={`px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
              kind === option.value
                ? 'bg-sky-400 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
