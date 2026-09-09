import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableList } from './SortableList'
import { INPUT } from './fieldStyles'
import { accentOf } from '../../constants/habitColors'
import type { ActionItem, Habit, SaveActionListInput } from '../../types/habit'

interface ActionListEditorProps {
  habit: Habit
  /** The stored routine, or empty when the habit has none yet. */
  items: ActionItem[]
  /** True once the habit has a stored routine — what "Delete action list" is offered for. */
  hasStored: boolean
  onSave: (input: SaveActionListInput) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onClose: () => void
}

/**
 * `crypto.randomUUID` needs a secure context, which every deployment of this app is. The
 * fallback exists so a plain-http dev host doesn't hand out `undefined` as a React key.
 */
const newId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`

/** 90 → "1:30". Steps are written in minutes and seconds, and read back the same way. */
export const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * The routine behind exercise mode: add steps, reorder them, and set a countdown on the
 * ones that are timed.
 *
 * The whole list is a local draft committed by one save, which is what makes reordering
 * free — the server takes the array as the order, so a drag is a state update rather than
 * a write per row. It replaces the page body rather than opening a modal, the same idiom
 * `HabitForm` uses.
 */
export function ActionListEditor({
  habit,
  items,
  hasStored,
  onSave,
  onDelete,
  onClose,
}: ActionListEditorProps) {
  const accent = accentOf(habit.color)

  const [draft, setDraft] = useState<ActionItem[]>(items)
  /** The step open in the sheet — an existing one, or a blank one being added. */
  const [editing, setEditing] = useState<ActionItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Cheap and exact: the draft is a handful of small objects, and comparing them by value
  // is what tells an actual edit apart from a step that was opened and closed again.
  const isDirty = JSON.stringify(draft) !== JSON.stringify(items)

  const upsert = (item: ActionItem) => {
    setDraft((current) =>
      current.some((candidate) => candidate.id === item.id)
        ? current.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [...current, item]
    )
    setEditing(null)
  }

  const remove = (id: string) =>
    setDraft((current) => current.filter((candidate) => candidate.id !== id))

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Ids go up as-is so a step keeps its identity across the save — the only reason
      // that matters is that reordering must not restart a running exercise session.
      await onSave({
        items: draft.map((item) => ({
          id: item.id,
          title: item.title,
          ...(item.description && { description: item.description }),
          ...(item.durationSeconds !== undefined && { durationSeconds: item.durationSeconds }),
        })),
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => (isDirty ? setConfirmDiscard(true) : onClose())

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={handleClose}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Action list</h2>
      </div>

      <p className="text-xs text-zinc-600 mb-6 pl-8">
        The steps exercise mode walks through, in order. Give a step a timer and it completes
        itself when the timer rings.
      </p>

      {draft.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-400">No steps yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Add the first one — a hang, a rest, a stretch.
          </p>
        </div>
      ) : (
        <>
          {draft.length > 1 && (
            <p className="text-xs text-zinc-600 mb-3">
              Drag the handles to set the order the steps run in.
            </p>
          )}

          <SortableList items={draft} keyOf={(item) => item.id} onReorder={setDraft}>
            {(item) => (
              <div className="flex items-center gap-3 h-full bg-zinc-900 rounded-xl pl-4 pr-1">
                <button
                  onClick={() => setEditing(item)}
                  className="flex-1 min-w-0 text-left h-full flex flex-col justify-center"
                >
                  <p className="text-zinc-100 truncate">{item.title}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {item.durationSeconds !== undefined && (
                      <span style={accent.text}>{formatDuration(item.durationSeconds)}</span>
                    )}
                    {item.durationSeconds !== undefined && item.description && ' · '}
                    {item.description}
                    {item.durationSeconds === undefined && !item.description && 'Check off'}
                  </p>
                </button>

                <button
                  onClick={() => remove(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="shrink-0 px-3 h-full text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </SortableList>
        </>
      )}

      <button
        onClick={() => setEditing({ id: newId(), title: '' })}
        className="w-full rounded-xl bg-zinc-900 border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 mt-3"
      >
        + Add step
      </button>

      {/* Only offered once there is something stored to delete — on a habit that never had
          a routine, saving nothing is the same thing and the button would be a no-op. */}
      {hasStored && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-red-400 hover:bg-zinc-800 mt-8"
        >
          Delete action list
        </button>
      )}

      {/* Clears the fixed save bar below, which would otherwise sit on top of the last row. */}
      <div className="h-24" />

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            style={accent.solid}
            className="w-full rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save action list'}
          </button>
        </div>
      </div>

      {editing && (
        <ActionItemSheet
          habit={habit}
          item={editing}
          onConfirm={upsert}
          onCancel={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this action list?"
        message="Every step goes with it and exercise mode disappears. The habit and its history are untouched."
        isConfirming={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Discard your changes?"
        message="The steps you edited here haven’t been saved yet."
        confirmLabel="Discard"
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  )
}

interface ActionItemSheetProps {
  habit: Habit
  item: ActionItem
  onConfirm: (item: ActionItem) => void
  onCancel: () => void
}

/**
 * One step, in a bottom sheet — the same shape `CountEditor` and `DurationEditor` open in.
 *
 * The timer is a toggle rather than "leave it at zero", because a zero-second countdown and
 * a step you check off yourself are different things and the field alone can't say which
 * was meant.
 */
function ActionItemSheet({ habit, item, onConfirm, onCancel }: ActionItemSheetProps) {
  const accent = accentOf(habit.color)

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [timed, setTimed] = useState(item.durationSeconds !== undefined)
  const [minutes, setMinutes] = useState(String(Math.floor((item.durationSeconds ?? 0) / 60)))
  const [seconds, setSeconds] = useState(String((item.durationSeconds ?? 0) % 60))

  const durationSeconds = (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
  // A timed step with no time on it would auto-complete the instant it started.
  const canSave = title.trim().length > 0 && (!timed || durationSeconds > 0)

  const handleConfirm = () =>
    onConfirm({
      id: item.id,
      title: title.trim(),
      ...(description.trim() && { description: description.trim() }),
      ...(timed && { durationSeconds }),
    })

  const digits = (value: string, max: number) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3)
    return cleaned === '' ? '' : String(Math.min(Number(cleaned), max))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto rounded-t-2xl bg-zinc-900 border-t border-zinc-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-400 mb-4">Step</p>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dead hang"
          autoFocus
          className={`${INPUT} mb-3`}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes (optional) — grip, edge size, how it should feel"
          rows={2}
          className={`${INPUT} resize-none mb-4`}
        />

        <button
          onClick={() => setTimed((current) => !current)}
          style={timed ? accent.solid : undefined}
          className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors mb-3 ${
            timed ? 'text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {timed ? 'Timed step' : 'Add a timer'}
        </button>

        {timed && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <input
              value={minutes}
              onChange={(e) => setMinutes(digits(e.target.value, 999))}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              aria-label="Minutes"
              className={`${INPUT} w-20 text-center text-2xl font-bold`}
            />
            <span className="text-2xl font-bold text-zinc-500">:</span>
            <input
              value={seconds}
              onChange={(e) => setSeconds(digits(e.target.value, 59))}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              aria-label="Seconds"
              className={`${INPUT} w-20 text-center text-2xl font-bold`}
            />
            <span className="text-xs text-zinc-500 ml-1">min : sec</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSave}
            style={accent.solid}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
