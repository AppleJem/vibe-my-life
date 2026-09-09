import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { formatDuration } from './ActionListEditor'
import { accentOf, withAlpha } from '../../constants/habitColors'
import { playTimerRing } from '../../utils/sounds'
import type { ActionItem, Habit } from '../../types/habit'

interface ExerciseModeProps {
  habit: Habit
  items: ActionItem[]
  onClose: () => void
}

/**
 * Runs a habit's routine end to end: a timed step counts down and completes itself when it
 * rings, an untimed one waits to be checked off.
 *
 * The countdown is anchored to a deadline rather than accumulated from ticks, so a phone
 * that sleeps mid-hang comes back with the right time left instead of a paused clock — the
 * interval only decides how often the number is repainted.
 */
export function ExerciseMode({ habit, items, onClose }: ExerciseModeProps) {
  const accent = accentOf(habit.color)

  const [doneIds, setDoneIds] = useState<string[]>([])
  const [currentId, setCurrentId] = useState<string | null>(items[0]?.id ?? null)
  /** Wall-clock ms the running countdown ends at, or null when it isn't running. */
  const [endsAt, setEndsAt] = useState<number | null>(null)
  /** Ms left on a paused countdown. Never set at the same time as `endsAt`. */
  const [pausedMs, setPausedMs] = useState<number | null>(null)
  /** Repaint tick. The time actually shown is always derived from `endsAt`. */
  const [, setNow] = useState(Date.now())
  const [confirmExit, setConfirmExit] = useState(false)

  const current = items.find((item) => item.id === currentId) ?? null
  const done = new Set(doneIds)
  const finished = items.length > 0 && items.every((item) => done.has(item.id))
  const running = endsAt !== null

  const msLeft = endsAt !== null ? Math.max(0, endsAt - Date.now()) : pausedMs
  const secondsLeft =
    msLeft !== null ? Math.ceil(msLeft / 1000) : (current?.durationSeconds ?? 0)

  /**
   * How far through the current step's countdown we are, 0 to 1 — or null when it hasn't
   * been started, which is also what makes the button read "Start" rather than "Resume".
   * Paused counts as started: the fill freezes where it got to rather than resetting.
   */
  const progress =
    msLeft !== null && current?.durationSeconds
      ? Math.min(1, Math.max(0, 1 - msLeft / (current.durationSeconds * 1000)))
      : null

  // The step whose completion the tick below is allowed to fire, so a countdown that
  // reaches zero between renders completes exactly once.
  const armedRef = useRef<string | null>(null)

  /**
   * Marks a step done and moves to the next one still outstanding, wrapping to the top so
   * a step skipped earlier is come back to rather than stranded.
   */
  const completeStep = (id: string) => {
    const nextDone = new Set([...doneIds, id])
    setDoneIds([...nextDone])
    setEndsAt(null)
    setPausedMs(null)
    armedRef.current = null

    const from = items.findIndex((item) => item.id === id)
    const next =
      items.slice(from + 1).find((item) => !nextDone.has(item.id)) ??
      items.find((item) => !nextDone.has(item.id))

    setCurrentId(next?.id ?? null)
  }

  useEffect(() => {
    if (endsAt === null) return

    const id = setInterval(() => {
      if (Date.now() < endsAt) {
        setNow(Date.now())
        return
      }
      // Guarded by the ref rather than by clearing the interval: the effect's cleanup
      // hasn't run yet at this point, and a second tick would ring twice.
      const armed = armedRef.current
      if (!armed) return
      armedRef.current = null
      playTimerRing()
      completeStep(armed)
    }, 200)

    return () => clearInterval(id)
  })

  /**
   * Keeps the screen on while a countdown runs. A routine's whole point is that you are
   * not holding the phone, and a display that sleeps takes the timer's face with it.
   * Best-effort — the API is absent on some browsers and rejects when the tab is hidden.
   */
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    void navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (released) void lock.release()
        else sentinel = lock
      })
      .catch(() => {
        // No lock; the timer still runs, the screen just may dim.
      })

    return () => {
      released = true
      void sentinel?.release()
    }
  }, [running])

  const startTimer = () => {
    if (!current?.durationSeconds) return
    armedRef.current = current.id
    setEndsAt(Date.now() + (pausedMs ?? current.durationSeconds * 1000))
    setPausedMs(null)
  }

  const pauseTimer = () => {
    if (endsAt === null) return
    setPausedMs(Math.max(0, endsAt - Date.now()))
    setEndsAt(null)
    armedRef.current = null
  }

  /** Selecting another step abandons whatever the current one had running. */
  const selectStep = (id: string) => {
    if (id === currentId) return
    setEndsAt(null)
    setPausedMs(null)
    armedRef.current = null
    setCurrentId(id)
  }

  /** Un-checks a step as readily as it checks one — a mis-tap mid-routine is common. */
  const toggleDone = (id: string) => {
    if (!done.has(id)) {
      completeStep(id)
      return
    }
    setDoneIds(doneIds.filter((candidate) => candidate !== id))
    setCurrentId(id)
  }

  const started = doneIds.length > 0 || running || pausedMs !== null
  const handleExit = () => (started && !finished ? setConfirmExit(true) : onClose())

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="shrink-0 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-zinc-900">
        <span className="text-xl">{habit.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{habit.name}</p>
          <p className="text-xs text-zinc-500">
            {doneIds.length} of {items.length} done
          </p>
        </div>
        <button
          onClick={handleExit}
          aria-label="Exit exercise mode"
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="shrink-0 h-1 transition-all duration-300"
        style={{ ...accent.solid, width: `${(doneIds.length / items.length) * 100}%` }}
      />

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {finished ? (
          <div className="text-center py-16">
            <p className="text-6xl mb-4">🎉</p>
            <p className="text-xl font-semibold text-zinc-100">Routine complete</p>
            <p className="text-sm text-zinc-500 mt-1">
              All {items.length} steps done. Log the habit itself back on its page.
            </p>
          </div>
        ) : (
          current && (
            <div className="text-center py-8">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Now</p>
              <p className="text-2xl font-semibold text-zinc-100">{current.title}</p>
              {current.description && (
                <p className="text-sm text-zinc-400 mt-2 whitespace-pre-line">
                  {current.description}
                </p>
              )}

              {current.durationSeconds !== undefined && (
                <p style={accent.text} className="text-7xl font-bold tabular-nums mt-8">
                  {formatDuration(secondsLeft)}
                </p>
              )}
            </div>
          )
        )}

        <div className="mt-6 space-y-2">
          {items.map((item, index) => {
            const isDone = done.has(item.id)
            const isCurrent = item.id === currentId

            return (
              <div
                key={item.id}
                style={isCurrent ? accent.ring : undefined}
                className={`flex items-center gap-3 rounded-xl bg-zinc-900 pl-3 pr-1 h-14 ${
                  isCurrent ? 'ring-2' : ''
                }`}
              >
                <button
                  onClick={() => toggleDone(item.id)}
                  aria-label={isDone ? `Un-check ${item.title}` : `Check off ${item.title}`}
                  style={isDone ? accent.solid : undefined}
                  className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-xs font-semibold ${
                    isDone ? 'text-zinc-950' : 'border border-zinc-700 text-zinc-500'
                  }`}
                >
                  {isDone ? '✓' : index + 1}
                </button>

                <button
                  onClick={() => selectStep(item.id)}
                  className="flex-1 min-w-0 text-left h-full flex flex-col justify-center"
                >
                  <p className={`truncate ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-100'}`}>
                    {item.title}
                  </p>
                  {item.durationSeconds !== undefined && (
                    <p className="text-xs text-zinc-500">{formatDuration(item.durationSeconds)}</p>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {finished ? (
          <button
            onClick={onClose}
            style={accent.solid}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-zinc-950"
          >
            Finish
          </button>
        ) : current?.durationSeconds !== undefined ? (
          <div className="flex gap-3">
            {/* Once started, the button becomes the countdown's progress bar — it is the
                largest thing on screen and otherwise idle, and a fill you can read at arm's
                length from a mat beats reading four digits. */}
            <button
              onClick={running ? pauseTimer : startTimer}
              style={progress === null ? accent.solid : undefined}
              className={`relative flex-1 overflow-hidden rounded-xl py-3.5 text-sm font-semibold ${
                progress === null ? 'text-zinc-950' : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {progress !== null && (
                <span
                  aria-hidden
                  style={{
                    width: `${progress * 100}%`,
                    // Translucent rather than the solid accent, so one label colour stays
                    // legible on both sides of the boundary; the leading edge is what
                    // actually reads as the position.
                    backgroundColor: withAlpha(accent.hex, 0.35),
                    borderRight: `2px solid ${accent.hex}`,
                    // Matches the tick interval, so the fill glides instead of stepping.
                    transition: 'width 200ms linear',
                  }}
                  className="absolute inset-y-0 left-0"
                />
              )}
              <span className="relative">
                {running ? 'Pause' : pausedMs !== null ? 'Resume' : 'Start'}
              </span>
            </button>
            {/* Finishing early is a real outcome — the hang failed, the rest was enough —
                and it is the only way past a timed step without waiting it out. */}
            <button
              onClick={() => current && completeStep(current.id)}
              className="rounded-xl bg-zinc-800 px-5 py-3.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
            >
              Skip
            </button>
          </div>
        ) : (
          current && (
            <button
              onClick={() => completeStep(current.id)}
              style={accent.solid}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-zinc-950"
            >
              Done — next step
            </button>
          )
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmExit}
        title="Leave the routine?"
        message="Where you got to isn’t saved — starting again starts from the top."
        confirmLabel="Leave"
        onConfirm={onClose}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  )
}
