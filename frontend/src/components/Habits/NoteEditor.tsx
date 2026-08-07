import { useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import type { Habit } from '../../types/habit'

interface NoteEditorProps {
  habit: Habit
  isSaving: boolean
  initialNotes?: string
  onConfirm: (notes: string) => void
  onCancel: () => void
}

/**
 * The edit sheet for a `boolean` completion, which carries no value — the note is the
 * only thing there is to correct. Count and duration habits get their own sheets, which
 * already have a note field under the value.
 */
export function NoteEditor({ habit, isSaving, initialNotes, onConfirm, onCancel }: NoteEditorProps) {
  const accent = accentOf(habit.color)
  const [notes, setNotes] = useState(initialNotes ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto rounded-t-2xl bg-zinc-900 border-t border-zinc-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-400 mb-4">Note</p>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note (optional)"
          autoFocus
          className="w-full px-3 py-2 text-base bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={isSaving}
            style={accent.solid}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
