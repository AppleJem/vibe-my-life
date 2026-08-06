import { useEffect, useRef, useState } from 'react'
import { accentOf } from '../../constants/habitColors'
import type { Habit } from '../../types/habit'

interface DurationEditorProps {
  habit: Habit
  isSaving: boolean
  onConfirm: (minutes: number, notes: string) => void
  onCancel: () => void
}

const PRESETS = [5, 10, 15, 30, 45, 60]

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Bottom sheet for a `duration` habit. Two ways in: pick a preset for something already
 * done, or run the stopwatch for something happening now — stopping it rounds up to the
 * next whole minute, since a 4:10 sit is a 5-minute sit and logging 4 reads as a failure.
 */
export function DurationEditor({ habit, isSaving, onConfirm, onCancel }: DurationEditorProps) {
  const accent = accentOf(habit.color)
  const [minutes, setMinutes] = useState(habit.target ?? 10)
  const [notes, setNotes] = useState('')
  const [elapsed, setElapsed] = useState<number | null>(null)

  const startedAtRef = useRef<number | null>(null)

  const running = elapsed !== null

  useEffect(() => {
    if (!running) return

    const id = setInterval(() => {
      if (startedAtRef.current === null) return
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)

    return () => clearInterval(id)
  }, [running])

  const startTimer = () => {
    startedAtRef.current = Date.now()
    setElapsed(0)
  }

  const stopTimer = () => {
    if (elapsed !== null) setMinutes(Math.max(1, Math.ceil(elapsed / 60)))
    startedAtRef.current = null
    setElapsed(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={running ? undefined : onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto rounded-t-2xl bg-zinc-900 border-t border-zinc-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-400 mb-6">How long?</p>

        <div className="text-center mb-5">
          <span style={accent.text} className="text-5xl font-bold">
            {running ? clock(elapsed!) : minutes}
          </span>
          <p className="text-xs text-zinc-500 mt-1">{running ? 'running' : 'minutes'}</p>
        </div>

        {running ? (
          <button
            onClick={stopTimer}
            className="w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-400 mb-4"
          >
            Stop timer
          </button>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMinutes(preset)}
                  style={minutes === preset ? accent.solid : undefined}
                  className={`py-2 rounded-lg text-sm transition-colors ${
                    minutes === preset
                      ? 'text-zinc-950 font-semibold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>

            <button
              onClick={startTimer}
              className="w-full rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 mb-4"
            >
              Or start a timer
            </button>
          </>
        )}

        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full px-3 py-2 text-base bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSaving || running}
            className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(minutes, notes)}
            disabled={isSaving || running}
            style={accent.solid}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Log it'}
          </button>
        </div>
      </div>
    </div>
  )
}
