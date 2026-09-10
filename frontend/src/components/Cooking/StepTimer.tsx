import { useEffect, useRef, useState } from 'react'
import { useWakeLock } from '../../hooks/useWakeLock'
import { playTimerRing, primeAudio } from '../../utils/sounds'
import { formatDuration, formatDurationLong } from '../../utils/units'

interface StepTimerProps {
  durationSeconds: number
  /** Labels the alarm in the aria text, so a screen reader says which step rang. */
  stepTitle: string
}

/**
 * The countdown on one step, run in place in the recipe's step list.
 *
 * Each timer is its own: a kitchen commonly has two or three things on clocks at once, and
 * a single global timer would make the second one a reason to leave the page. Nothing is
 * coordinated between them beyond the screen lock, which each holds separately.
 *
 * The clock is anchored to a wall-clock deadline rather than accumulated from ticks, so a
 * phone that sleeps mid-simmer comes back with the right time left instead of a paused
 * clock. The interval only decides how often the number is repainted.
 */
export function StepTimer({ durationSeconds, stepTitle }: StepTimerProps) {
  /** Wall-clock ms the countdown ends at, or null when it isn't running. */
  const [endsAt, setEndsAt] = useState<number | null>(null)
  /** Ms left on a paused countdown. Never set at the same time as `endsAt`. */
  const [pausedMs, setPausedMs] = useState<number | null>(null)
  const [rang, setRang] = useState(false)
  /** Repaint tick. The time shown is always derived from `endsAt`. */
  const [, setNow] = useState(Date.now())

  const running = endsAt !== null
  // Guards the ring against a deadline crossed twice between renders.
  const armedRef = useRef(false)

  useWakeLock(running)

  useEffect(() => {
    if (endsAt === null) return

    const id = setInterval(() => {
      if (Date.now() < endsAt) {
        setNow(Date.now())
        return
      }
      // The effect's cleanup hasn't run at this point, so without the ref a second tick
      // would ring again.
      if (!armedRef.current) return
      armedRef.current = false
      playTimerRing()
      setEndsAt(null)
      setPausedMs(null)
      setRang(true)
    }, 200)

    return () => clearInterval(id)
  })

  const msLeft = endsAt !== null ? Math.max(0, endsAt - Date.now()) : pausedMs
  const secondsLeft = msLeft !== null ? Math.ceil(msLeft / 1000) : durationSeconds

  /** 0 to 1 through the countdown, or null before it has been started. */
  const progress =
    msLeft !== null ? Math.min(1, Math.max(0, 1 - msLeft / (durationSeconds * 1000))) : null

  const start = () => {
    // The tap that starts a countdown is the last user gesture before the bell rings,
    // minutes later, from a timer callback. Opening the audio context here is what makes
    // that bell audible at all.
    primeAudio()
    armedRef.current = true
    setRang(false)
    setEndsAt(Date.now() + (pausedMs ?? durationSeconds * 1000))
    setPausedMs(null)
  }

  const pause = () => {
    if (endsAt === null) return
    setPausedMs(Math.max(0, endsAt - Date.now()))
    setEndsAt(null)
    armedRef.current = false
  }

  const reset = () => {
    setEndsAt(null)
    setPausedMs(null)
    setRang(false)
    armedRef.current = false
  }

  if (rang) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 h-8 text-xs font-semibold text-zinc-950">
          ⏰ Time&rsquo;s up
        </span>
        <button
          onClick={start}
          className="rounded-lg bg-zinc-800 px-2.5 h-8 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Again
        </button>
      </div>
    )
  }

  // Untouched: a badge that reads as the step's duration first and a button second.
  if (progress === null) {
    return (
      <button
        onClick={start}
        aria-label={`Start the ${formatDurationLong(durationSeconds)} timer for ${stepTitle}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 h-8 text-xs font-semibold text-amber-400 hover:bg-zinc-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {formatDurationLong(durationSeconds)}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Running or paused, the button is also the progress bar: it is the only idle surface
          of any size, and a fill you can read from across the kitchen beats four digits. */}
      <button
        onClick={running ? pause : start}
        className="relative overflow-hidden rounded-lg bg-zinc-800 px-3 h-8 min-w-24 text-xs font-semibold text-zinc-100"
      >
        <span
          aria-hidden
          style={{
            width: `${progress * 100}%`,
            // Matches the tick interval, so the fill glides rather than stepping.
            transition: 'width 200ms linear',
          }}
          className="absolute inset-y-0 left-0 bg-amber-400/30 border-r-2 border-amber-400"
        />
        <span className="relative tabular-nums">
          {formatDuration(secondsLeft)}
          <span className="ml-1.5 text-zinc-400">{running ? '❙❙' : '▶'}</span>
        </span>
      </button>

      <button
        onClick={reset}
        aria-label={`Reset the timer for ${stepTitle}`}
        className="rounded-lg px-1.5 h-8 text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
      >
        Reset
      </button>
    </div>
  )
}
