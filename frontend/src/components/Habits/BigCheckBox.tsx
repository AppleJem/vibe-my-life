import { useLongPress } from '../../hooks/useLongPress'
import { accentOf } from '../../constants/habitColors'
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

  const { handlers, progress, isHolding } = useLongPress({
    onComplete: onHoldComplete,
    disabled,
  })

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
        className={`relative w-56 h-56 rounded-[2rem] flex items-center justify-center touch-none select-none transition-colors duration-200 ${
          isDone
            ? `${accent.solid} shadow-lg`
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
              className={accent.text}
              stroke="currentColor"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>
        )}

        <span className={`text-7xl transition-opacity ${isDone ? '' : 'opacity-40'}`}>
          {isDone ? '✓' : habit.emoji}
        </span>
      </button>

      <p className={`text-sm ${isDone ? accent.text : 'text-zinc-500'}`}>{caption}</p>
    </div>
  )
}
