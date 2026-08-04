import { FREQUENCIES, FREQUENCY_LABEL } from '../../../utils/recurring'
import type { RecurringFrequency, TransactionType } from '../../../types/expense'

/** `null` is "one-time" — the resting state, and what every plain entry uses. */
export type FrequencyValue = RecurringFrequency | null

interface FrequencyPickerProps {
  value: FrequencyValue
  onChange: (value: FrequencyValue) => void
  /** Drives the selected-pill colour, matching the modal's expense/income accent. */
  type: TransactionType
}

/**
 * One-time / Daily / Weekly / Monthly / Yearly, as a pill row.
 *
 * Same shape as `TypeToggle` but not built on it — that component is deliberately hard-
 * wired to the two transaction directions, including their per-direction accent classes.
 */
const ACTIVE: Record<TransactionType, string> = {
  expense: 'bg-pink-500 text-white',
  income: 'bg-lime-500 text-zinc-950',
}

export function FrequencyPicker({ value, onChange, type }: FrequencyPickerProps) {
  const options: { key: FrequencyValue; label: string }[] = [
    { key: null, label: 'One-time' },
    ...FREQUENCIES.map((frequency) => ({ key: frequency, label: FREQUENCY_LABEL[frequency] })),
  ]

  return (
    <div role="tablist" className="flex gap-1.5 overflow-x-auto pb-1">
      {options.map((option) => {
        const isActive = option.key === value
        return (
          <button
            key={option.key ?? 'once'}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              isActive ? ACTIVE[type] : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
