import { QuantityText } from './QuantityText'
import { StepTimer } from './StepTimer'
import type { UnitSystem } from '../../utils/units'
import type { RecipeStep } from '../../types/recipe'

interface StepListProps {
  steps: RecipeStep[]
  factor: number
  system: UnitSystem
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
 */
export function StepList({ steps, factor, system }: StepListProps) {
  if (steps.length === 0) {
    return <p className="text-sm text-zinc-600">No steps listed.</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-400">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              <QuantityText
                text={step.title}
                quantities={step.quantities}
                factor={factor}
                system={system}
              />
            </p>

            {step.description && (
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-400">
                <QuantityText
                  text={step.description}
                  quantities={step.quantities}
                  factor={factor}
                  system={system}
                />
              </p>
            )}

            {step.durationSeconds !== undefined && (
              <div className="mt-2">
                <StepTimer durationSeconds={step.durationSeconds} stepTitle={step.title} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
