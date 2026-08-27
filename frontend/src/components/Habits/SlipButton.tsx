import { SLIP_COLOR } from '../../constants/habitColors'
import type { Habit } from '../../types/habit'

interface SlipButtonProps {
  habit: Habit
  /** Whether today is already marked as a slip. A marked day makes the button inert. */
  isSlipped: boolean
  isSaving: boolean
  /** Fired on tap. The caller opens the confirmation; this button never logs directly. */
  onPress: () => void
}

/**
 * The avoid habit's hero, in place of `BigCheckBox`.
 *
 * Same geometry as the check box it replaces, so the page doesn't reflow between the two
 * kinds of habit — but it is deliberately its opposite in every other respect:
 *
 * - **A tap, not a hold.** The friction lives in the ten-second confirmation this opens;
 *   stacking a three-second hold on top of that would just be punitive.
 * - **Silent.** No charge swoosh, no completion klang. A slip is not a reward, and the one
 *   thing the sounds are for is making completion feel good.
 *
 * Once today is marked the button goes inert, the same as the check box: undo lives down in
 * the history list, out of thumb's reach.
 */
export function SlipButton({ habit, isSlipped, isSaving, onPress }: SlipButtonProps) {
  const disabled = isSlipped || isSaving

  const caption = isSlipped ? 'Slipped today' : isSaving ? 'Saving…' : 'Tap if you slipped'

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <button
        onClick={onPress}
        disabled={disabled}
        aria-label={isSlipped ? `${habit.name} slipped today` : `Mark a slip for ${habit.name}`}
        style={isSlipped ? { backgroundColor: SLIP_COLOR } : undefined}
        className={`relative w-56 h-56 rounded-[2rem] flex items-center justify-center select-none transition-colors duration-200 active:scale-[0.97] transition-transform ${
          isSlipped ? 'shadow-lg' : 'bg-zinc-900 border-2 border-zinc-800'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSlipped ? '#ffffff' : SLIP_COLOR}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={`w-28 h-28 ${isSlipped ? '' : 'opacity-50'}`}
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <p
        style={isSlipped ? { color: SLIP_COLOR } : undefined}
        className={`text-sm ${isSlipped ? '' : 'text-zinc-500'}`}
      >
        {caption}
      </p>
    </div>
  )
}
