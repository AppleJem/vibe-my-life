interface TextAreaInputProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  /** Note is a one-liner; remarks is meant to hold a paragraph. */
  rows?: number
}

export function TextAreaInput({
  value,
  onChange,
  label,
  placeholder,
  rows = 2,
}: TextAreaInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus
        className="w-full px-3 py-2 text-base bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-none"
      />
    </div>
  )
}
