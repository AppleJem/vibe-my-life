interface NoteInputProps {
  value: string
  onChange: (note: string) => void
}

export function NoteInput({ value, onChange }: NoteInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        Note (optional)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What was this expense for?"
        rows={2}
        autoFocus
        className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-none"
      />
    </div>
  )
}
