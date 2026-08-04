interface NoteInputProps {
  value: string
  onChange: (note: string) => void
}

export function NoteInput({ value, onChange }: NoteInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-400 mb-2">
        Note (optional)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What was this expense for?"
        rows={3}
        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-none"
      />
    </div>
  )
}
