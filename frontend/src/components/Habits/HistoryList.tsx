import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { CountEditor } from './CountEditor'
import { DurationEditor } from './DurationEditor'
import { NoteEditor } from './NoteEditor'
import { formatShortDate, formatValue } from '../../utils/habit'
import type { Completion, Habit, UpdateCompletionInput } from '../../types/habit'

interface HistoryListProps {
  habit: Habit
  completions: Completion[]
  onDelete: (timestamp: string) => Promise<unknown>
  /** Absent leaves the list delete-only. */
  onEdit?: (timestamp: string, input: UpdateCompletionInput) => Promise<unknown>
}

/**
 * Reverse-chronological log, and the only place a completion can be corrected or removed
 * — the big box goes inert once a day is logged, so both live down here rather than under
 * the same gesture that created it.
 *
 * An edit reopens the sheet the completion was logged with, seeded with what it holds
 * now. The day itself isn't editable: it's the subject of the one-per-day rule, so moving
 * a completion means removing it and logging the other day.
 */
export function HistoryList({ habit, completions, onDelete, onEdit }: HistoryListProps) {
  const [pending, setPending] = useState<Completion | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editing, setEditing] = useState<Completion | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const ordered = [...completions].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const confirmDelete = async () => {
    if (!pending) return

    setIsDeleting(true)
    try {
      await onDelete(pending.timestamp)
      setPending(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const saveEdit = async (input: UpdateCompletionInput) => {
    if (!editing || !onEdit) return

    setIsSaving(true)
    try {
      await onEdit(editing.timestamp, input)
      setEditing(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">History</h3>

      {ordered.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing logged yet.</p>
      ) : (
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
          {ordered.map((completion) => (
            <div
              key={completion.timestamp}
              className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-b-0"
            >
              <span className="text-sm text-zinc-400 w-14 shrink-0">
                {formatShortDate(completion.date)}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-100">{formatValue(habit, completion)}</p>
                {completion.notes && (
                  <p className="text-xs text-zinc-500 truncate">{completion.notes}</p>
                )}
              </div>

              {onEdit && (
                <button
                  onClick={() => setEditing(completion)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
                  aria-label={`Edit ${completion.date}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => setPending(completion)}
                className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                aria-label={`Delete ${completion.date}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={pending !== null}
        title="Remove this log?"
        message={
          pending
            ? `${formatShortDate(pending.date)} · ${formatValue(habit, pending)}. This frees the day up to be logged again.`
            : undefined
        }
        confirmLabel="Remove"
        isConfirming={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />

      {editing && habit.type === 'count' && (
        <CountEditor
          habit={habit}
          isSaving={isSaving}
          initialCount={editing.count}
          initialNotes={editing.notes}
          confirmLabel="Save"
          onConfirm={(count, notes) => void saveEdit({ count, notes })}
          onCancel={() => setEditing(null)}
        />
      )}

      {editing && habit.type === 'duration' && (
        <DurationEditor
          habit={habit}
          isSaving={isSaving}
          initialMinutes={editing.durationMinutes}
          initialNotes={editing.notes}
          confirmLabel="Save"
          onConfirm={(durationMinutes, notes) => void saveEdit({ durationMinutes, notes })}
          onCancel={() => setEditing(null)}
        />
      )}

      {editing && habit.type === 'boolean' && (
        <NoteEditor
          habit={habit}
          isSaving={isSaving}
          initialNotes={editing.notes}
          onConfirm={(notes) => void saveEdit({ notes })}
          onCancel={() => setEditing(null)}
        />
      )}
    </section>
  )
}
