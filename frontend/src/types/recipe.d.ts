/**
 * Mirrors `backend/src/modules/recipe/recipe.types.d.ts`. Cooking is the third life app,
 * with its own table and nothing shared with expenses or habits.
 */

/**
 * One measured amount: "2 cups", "500 g", "350 °F", or a bare "3" when the ingredient is
 * its own unit ("3 eggs").
 *
 * `unit` is a canonical token from `utils/units.ts` when the server recognised one, and
 * free text otherwise — an unrecognised unit still scales with the servings, it just has
 * no system to convert into.
 */
export interface Quantity {
  amount: number
  /** Absent means a bare count. */
  unit?: string
}

export interface Ingredient {
  id: string
  name: string
  /** Absent for "salt to taste" — nothing to scale. */
  quantity?: Quantity
  note?: string
}

/**
 * A step, shaped after a habit's `ActionItem`: title, optional description, optional
 * countdown, where the absence of `durationSeconds` is what makes it a check-off step.
 *
 * Amounts inside the prose live in `quantities` rather than in the text, which carries
 * `{0}`, `{1}` … markers where they belong. Rendering substitutes each marker with its
 * amount scaled for the current servings and converted to the chosen system — the same two
 * transformations the ingredient list applies, so a step can't disagree with the list
 * above it. See `splitQuantityText` in `utils/units.ts`.
 */
export interface RecipeStep {
  id: string
  title: string
  description?: string
  durationSeconds?: number
  quantities?: Quantity[]
}

export interface Recipe {
  id: string
  title: string
  emoji: string
  description?: string
  /**
   * The yield the stored amounts are written for. Never changed by the servings stepper —
   * that picks a *display* figure, and the ratio between the two is the scale factor.
   */
  servings: number
  ingredients: Ingredient[]
  steps: RecipeStep[]
  createdAt: string
  updatedAt: string
}

/** What a create or a save sends. A save replaces the whole recipe. */
export interface RecipeInput {
  title: string
  emoji?: string
  description?: string
  servings: number
  ingredients: { id?: string; name: string; quantity?: Quantity; note?: string }[]
  steps: {
    id?: string
    title: string
    description?: string
    durationSeconds?: number
    quantities?: Quantity[]
  }[]
}

/** A parsed recipe that hasn't been saved yet — what the review screen is handed. */
export interface RecipeDraft {
  title: string
  emoji: string
  description?: string
  servings: number
  ingredients: { name: string; quantity?: Quantity; note?: string }[]
  steps: {
    title: string
    description?: string
    durationSeconds?: number
    quantities?: Quantity[]
  }[]
}
