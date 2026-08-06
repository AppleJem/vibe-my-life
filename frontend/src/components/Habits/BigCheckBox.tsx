import { useEffect, useRef } from 'react'
import { useLongPress } from '../../hooks/useLongPress'
import { accentOf } from '../../constants/habitColors'
import { playChargeSwoosh, playCompletionKlang } from '../../utils/sounds'
import type { Habit } from '../../types/habit'

interface BigCheckBoxProps {
  habit: Habit
  /** Whether today is already logged. A logged day makes the box inert. */
  isDone: boolean
  isSaving: boolean
  /**
   * Fired once the hold completes. Boolean habits log straight away; count and duration
   * habits open their editor, which is why this doesn't take a value.
   */
  onHoldComplete: () => void
}

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The one interactive thing on the detail page: hold to log today.
 *
 * Hold rather than tap because the box is deliberately enormous, and because a habit log
 * carries a date that can't be edited afterwards — only deleted. Once today is logged the
 * box goes inert; undo lives down in the history list, out of thumb's reach.
 */
export function BigCheckBox({ habit, isDone, isSaving, onHoldComplete }: BigCheckBoxProps) {
  const accent = accentOf(habit.color)
  const disabled = isDone || isSaving

  const swooshRef = useRef<ReturnType<typeof playChargeSwoosh> | null>(null)

  const { handlers, progress, isHolding } = useLongPress({
    onComplete: () => {
      // Stop the swoosh and fire the klang
      swooshRef.current?.stop()
      swooshRef.current = null
      playCompletionKlang()
      onHoldComplete()
    },
    disabled,
  })

  // Start/stop the charge swoosh when holding state changes
  useEffect(() => {
    if (isHolding && !isDone) {
      swooshRef.current = playChargeSwoosh(5) // matches the 5s hold duration
    } else {
      swooshRef.current?.stop()
      swooshRef.current = null
    }

    return () => {
      swooshRef.current?.stop()
      swooshRef.current = null
    }
  }, [isHolding, isDone])

  const caption = isDone
    ? 'Done today'
    : isSaving
      ? 'Saving…'
      : isHolding
        ? 'Keep holding…'
        : 'Hold to complete'

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <button
        {...handlers}
        disabled={disabled}
        aria-label={isDone ? `${habit.name} done today` : `Hold to complete ${habit.name}`}
        // touch-none stops the browser claiming the gesture as a scroll mid-hold; the
        // page still scrolls anywhere outside the box.
        style={isDone ? accent.solid : undefined}
        className={`relative w-56 h-56 rounded-[2rem] flex items-center justify-center touch-none select-none transition-colors duration-200 ${
          isDone
            ? 'shadow-lg'
            : `bg-zinc-900 border-2 border-zinc-800 ${isHolding ? 'scale-[0.97]' : ''}`
        } transition-transform`}
      >
        {/* The fill ring, drawn only while holding. Rotated so it starts at 12 o'clock. */}
        {!isDone && (
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="3"
              className="stroke-zinc-800"
            />
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              stroke={accent.hex}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
        )}

        <span className={`text-7xl transition-opacity ${isDone ? '' : 'opacity-40'}`}>
          {isDone ? '✓' : habit.emoji}
        </span>
      </button>

      <p style={isDone ? accent.text : undefined} className={`text-sm ${isDone ? '' : 'text-zinc-500'}`}>
        {caption}
      </p>
    </div>
  )
}
