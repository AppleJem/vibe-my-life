import type { UnitSystem } from '../../utils/units'

interface UnitToggleProps {
  value: UnitSystem
  onChange: (system: UnitSystem) => void
  /**
   * False when nothing on the page would change — every amount is a count, a spoon measure,
   * or already in both systems' shared vocabulary. The toggle is shown disabled rather than
   * hidden, so its absence never reads as the feature being missing.
   */
  enabled: boolean
}

const OPTIONS: { system: UnitSystem; label: string }[] = [
  { system: 'us', label: 'US' },
  { system: 'metric', label: 'Metric' },
]

/**
 * One switch for the whole recipe — ingredients and steps both. Per-amount conversion was
 * never the point: a recipe half in grams and half in cups is harder to cook from than
 * either one alone.
 *
 * Teaspoons and tablespoons are left alone in both positions. They are the same spoon in
 * every kitchen, so "1 tbsp" is already the instruction and "14.8 ml" is only arithmetic.
 */
export function UnitToggle({ value, onChange, enabled }: UnitToggleProps) {
  return (
    <div
      className={`flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1 ${
        enabled ? '' : 'opacity-40'
      }`}
      title={enabled ? undefined : 'Nothing in this recipe converts'}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.system}
          onClick={() => onChange(option.system)}
          disabled={!enabled}
          aria-pressed={value === option.system}
          className={`px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
            value === option.system
              ? 'bg-amber-400 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
