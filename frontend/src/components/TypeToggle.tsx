import type { TransactionType } from '../types/expense'

interface TypeToggleProps {
  value: TransactionType
  onChange: (type: TransactionType) => void
  /** Full width by default; `inline` keeps the pills at their natural size. */
  inline?: boolean
  className?: string
}

const OPTIONS: { key: TransactionType; label: string; active: string }[] = [
  { key: 'expense', label: 'Expense', active: 'bg-pink-500 text-white' },
  { key: 'income', label: 'Income', active: 'bg-lime-500 text-zinc-950' },
]

/**
 * The expense/income switch, shared by the add modal, the chart breakdown and the
 * categories settings page so the three stay visually identical.
 *
 * Deliberately modelled on the currency pill row rather than `ViewTabs` — that one is
 * a fixed bottom nav and reads as app-level navigation, which this is not.
 */
export function TypeToggle({ value, onChange, inline = false, className = '' }: TypeToggleProps) {
  return (
    <div role="tablist" className={`flex gap-1.5 ${className}`}>
      {OPTIONS.map((option) => {
        const isActive = option.key === value
        return (
          <button
            key={option.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.key)}
            className={`${inline ? 'shrink-0' : 'flex-1'} px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              isActive ? option.active : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
