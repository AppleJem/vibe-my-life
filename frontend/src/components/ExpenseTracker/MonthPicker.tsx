interface MonthPickerProps {
  value: string // YYYY-MM
  onChange: (month: string) => void
  label?: string
}

export function MonthPicker({ value, onChange, label }: MonthPickerProps) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-zinc-500 text-xs shrink-0">{label}</span>
      )}
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50 [color-scheme:dark]"
      />
    </div>
  )
}
