import { QuantityValue } from './QuantityText'
import type { UnitSystem } from '../../utils/units'
import type { Ingredient } from '../../types/recipe'

interface IngredientListProps {
  ingredients: Ingredient[]
  /** `chosenServings / recipe.servings` — 1 when the recipe is read as written. */
  factor: number
  system: UnitSystem
}

/**
 * The shopping half of a recipe. Amounts lead the row rather than trail the name: scaled
 * against a different serving count they are the part that changed, and a column of them is
 * what the list is read as while gathering.
 *
 * An ingredient with no amount ("salt, to taste") simply has nothing in that column. It is
 * not given a "1" to make the layout tidy — that would be an instruction nobody wrote.
 */
export function IngredientList({ ingredients, factor, system }: IngredientListProps) {
  if (ingredients.length === 0) {
    return <p className="text-sm text-zinc-600">No ingredients listed.</p>
  }

  return (
    <ul className="divide-y divide-zinc-900">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="flex gap-3 py-2.5">
          <span className="w-24 shrink-0 text-right text-sm">
            {ingredient.quantity ? (
              <QuantityValue quantity={ingredient.quantity} factor={factor} system={system} />
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </span>

          <span className="min-w-0 flex-1 text-sm text-zinc-100">
            {ingredient.name}
            {ingredient.note && (
              <span className="text-zinc-500">, {ingredient.note}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
