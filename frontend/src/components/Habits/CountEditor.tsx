import { useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import type { Habit } from '../../types/habit'

interface CountEditorProps {
  habit: Habit
  isSaving: boolean
  onConfirm: (count: number, notes: string) => void
  onCancel: () => void
}

const QUICK_ADD = [1, 5, 10]

/**
 * Bottom sheet that opens after the hold on a `count` habit. Starts at the habit's
 * target when it has one — the common case is "I did the thing as planned", and typing
 * should be for the exception.
 */
export function CountEditor({ habit, isSaving, onConfirm, onCancel }: CountEditorProps) {
  const accent = accentOf(habit.color)
  const [count, setCount] = useState(habit.target ?? 1)
  const [notes, setNotes] = useState('')

  const unit = habit.unit ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto rounded-t-2xl bg-zinc-900 border-t border-zinc-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-400 mb-6">
          How many {unit || 'this time'}?
        </p>

        <div className="flex items-center justify-center gap-6 mb-5">
          <button
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="w-12 h-12 rounded-full bg-zinc-800 text-2xl text-zinc-300 hover:bg-zinc-700"
            aria-label="Decrease"
          >
            −
          </button>

          <div className="text-center min-w-24">
            <span className={`text-5xl font-bold ${accent.text}`}>{count}</span>
            {unit && <p className="text-xs text-zinc-500 mt-1">{unit}</p>}
          </div>

          <button
            onClick={() => setCount((c) => c + 1)}
            className="w-12 h-12 rounded-full bg-zinc-800 text-2xl text-zinc-300 hover:bg-zinc-700"
            aria-label="Increase"
          >
            +
          </button>
        </div>

        <div className="flex justify-center gap-2 mb-5">
          {QUICK_ADD.map((step) => (
            <button
              key={step}
              onClick={() => setCount((c) => c + step)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              +{step}
            </button>
          ))}
        </div>

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note (optional)"
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
            onClick={() => onConfirm(count, notes)}
            disabled={isSaving}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50 ${accent.solid}`}
          >
            {isSaving ? 'Saving…' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  )
}
