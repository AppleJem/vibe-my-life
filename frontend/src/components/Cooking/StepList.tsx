import { QuantityText } from './QuantityText'
import { StepTimer } from './StepTimer'
import type { UnitSystem } from '../../utils/units'
import type { RecipeStep } from '../../types/recipe'

interface StepListProps {
  steps: RecipeStep[]
  factor: number
  system: UnitSystem
  /** Steps checked off in this cooking session. */
  doneIds: ReadonlySet<string>
  onToggleDone: (stepId: string) => void
}

/**
 * The method. Steps carry the same three parts a habit's action item does — a title, an
 * optional description, an optional timer — and the timer runs here, in the row, rather than
 * on a screen of its own: a step's countdown is something you start and then walk away
 * from, and the recipe is what you walk back to.
 *
 * Amounts inside a step's text are rendered from its `quantities`, through exactly the
 * scaling and conversion the ingredient list above applies. That is the whole reason they
 * are stored apart from the prose — "add the flour" can't go stale against the list, because
 * both sides of the page are reading the same numbers.
 *
 * The number circle doubles as the step's checkbox. It is already the thing that marks where
 * a step starts, so it is where the eye goes to find your place — and a done step keeps its
 * row, just dimmed, rather than collapsing: you often glance back at a finished step to check
 * how much of something went in.
 */
export function StepList({ steps, factor, system, doneIds, onToggleDone }: StepListProps) {
  if (steps.length === 0) {
    return <p className="text-sm text-zinc-600">No steps listed.</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const done = doneIds.has(step.id)

        return (
          <li key={step.id} className="flex gap-3">
            {/* The circle is 28px; the padding around it takes the tap target to 36px, which
                is about the smallest a floury thumb reliably hits. */}
            <button
              onClick={() => onToggleDone(step.id)}
              aria-pressed={done}
              aria-label={done ? `Mark step ${index + 1} as not done` : `Mark step ${index + 1} as done`}
              className="-m-1 shrink-0 self-start rounded-full p-1"
            >
              <span
                className={`mt-0.5 grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition-colors ${
                  done
                    ? 'border-amber-400 bg-amber-400 text-zinc-950'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium transition-colors ${
                  done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'
                }`}
              >
                <QuantityText
                  text={step.title}
                  quantities={step.quantities}
                  factor={factor}
                  system={system}
                  muted={done}
                />
              </p>

              {step.description && (
                <p
                  className={`mt-1 whitespace-pre-line text-sm transition-colors ${
                    done ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  <QuantityText
                    text={step.description}
                    quantities={step.quantities}
                    factor={factor}
                    system={system}
                    muted={done}
                  />
                </p>
              )}

              {/* Stays mounted when the step is checked off: unmounting would throw away a
                  countdown that is still running, and ticking a step while its timer runs is
                  normal — you mark the sauce done and let it simmer out. */}
              {step.durationSeconds !== undefined && (
                <div className="mt-2">
                  <StepTimer durationSeconds={step.durationSeconds} stepTitle={step.title} />
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
