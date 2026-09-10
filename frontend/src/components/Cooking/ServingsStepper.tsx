interface ServingsStepperProps {
  /** The figure on screen, which starts at the recipe's own yield. */
  value: number
  /** The recipe's stored yield, shown when the two have drifted apart. */
  base: number
  onChange: (servings: number) => void
}

/** One is the floor — a recipe for nobody has nothing to scale. */
const MIN = 1
/** Past this the fractions stop being useful and the arithmetic stops being a recipe. */
const MAX = 99

/**
 * Picks how many servings the page is showing, one at a time.
 *
 * Deliberately not typable: whole numbers are the only values that make sense, the useful
 * range is a few steps either side of what the recipe was written for, and a keyboard over
 * the ingredient list is a worse trade than two taps. The recipe's own yield is shown
 * underneath once the two differ, so it is always clear what is being scaled *from* — and
 * tapping it is the way back.
 */
export function ServingsStepper({ value, base, onChange }: ServingsStepperProps) {
  const step = (delta: number) => onChange(Math.min(MAX, Math.max(MIN, value + delta)))

  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Servings</p>
        {value !== base && (
          <button
            onClick={() => onChange(base)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            written for {base} · reset
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 p-1">
        <button
          onClick={() => step(-1)}
          disabled={value <= MIN}
          aria-label="One fewer serving"
          className="w-9 h-9 rounded-lg text-xl font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          −
        </button>
        <span className="w-10 text-center text-lg font-bold text-amber-400 tabular-nums">
          {value}
        </span>
        <button
          onClick={() => step(1)}
          disabled={value >= MAX}
          aria-label="One more serving"
          className="w-9 h-9 rounded-lg text-xl font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          +
        </button>
      </div>
    </div>
  )
}
