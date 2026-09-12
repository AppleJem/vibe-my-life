import { stepGrade } from '../../utils/climbing'
import type { GradeKind } from '../../types/climbing'

interface GradeFieldProps {
  value: string
  kind: GradeKind
  /** Prefixed to the number in integer mode, so the field reads "V 4" not a bare "4". */
  system: string
  onChange: (grade: string) => void
}

/**
 * The grade, edited the way its scale wants to be edited.
 *
 * Integer scales are stepped rather than typed — V4 to V5 is one tap, and a numeric keypad
 * over a list you're adding to between climbs is worse than two buttons. Lettered scales
 * ("6b+", "5.11c") have no next value to step to, so they get a short text field.
 *
 * The stored value is text in both modes, which is why switching the toggle mid-session
 * shows the same grades rather than clearing them.
 */
export function GradeField({ value, kind, system, onChange }: GradeFieldProps) {
  if (kind === 'string') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Grade"
        aria-label="Grade"
        className="w-24 px-2 py-1.5 text-sm text-center bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
      />
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-zinc-800 border border-zinc-700 p-0.5">
      <button
        type="button"
        onClick={() => onChange(stepGrade(value, -1))}
        aria-label="Lower grade"
        className="w-8 h-8 rounded-md text-lg font-semibold text-zinc-300 hover:bg-zinc-700"
      >
        −
      </button>
      <span className="w-12 text-center text-sm font-bold text-sky-400 tabular-nums">
        {value === '' ? '—' : `${system.length <= 3 ? system : ''}${value}`}
      </span>
      <button
        type="button"
        onClick={() => onChange(stepGrade(value, 1))}
        aria-label="Higher grade"
        className="w-8 h-8 rounded-md text-lg font-semibold text-zinc-300 hover:bg-zinc-700"
      >
        +
      </button>
    </div>
  )
}
