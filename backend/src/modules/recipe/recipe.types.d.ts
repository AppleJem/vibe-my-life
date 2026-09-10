/**
 * Cooking lives in its own table (`vibe-my-life-cooking`), keyed the way the other apps
 * are: `PK = USER#<userId>`, with the sort key discriminating the item shapes.
 *
 *   Recipe  SK = RECIPE#<recipeId>
 *
 * A recipe is one item — ingredients and steps are embedded rather than stored as rows of
 * their own. They are only ever read and written together (the list page is the only thing
 * that wants less, and a recipe is small), and embedding is what lets a save be atomic:
 * a half-written recipe whose steps no longer match its ingredients is not a state the
 * app has to have an opinion about.
 */

/**
 * One measured amount: "2 cups", "500 g", "350 °F", or bare "3" when the unit is the
 * ingredient itself ("3 eggs").
 *
 * `unit` is a canonical token from `recipe.units.ts` whenever the parser recognised one.
 * Anything it didn't recognise is kept verbatim — a free-text unit still scales with the
 * servings, it just has no system to be converted into.
 */
export interface Quantity {
  amount: number
  /** Absent means a bare count. */
  unit?: string
}

export interface Ingredient {
  /** Stable across saves, so reordering doesn't make a row look like a different one. */
  id: string
  name: string
  /** Absent for "to taste" / "a splash of" — things with no number to scale. */
  quantity?: Quantity
  /** "finely diced", "room temperature" — kept out of `name` so the name stays searchable. */
  note?: string
}

/**
 * One step, shaped after a habit's `ActionItem`: a title, an optional description, and an
 * optional countdown. `durationSeconds` absent means a step you simply do and tick off.
 *
 * Quantities inside a step's prose can't be scaled as text, so they aren't text: the
 * parser pulls them out into `quantities` and leaves `{0}`, `{1}` … markers behind in
 * `title`/`description` where they stood. Rendering substitutes each marker with its
 * amount, scaled for the current servings and converted to the chosen system — the same
 * two transformations the ingredient list applies, so the two can never disagree.
 *
 * A marker with no matching entry renders as the literal text it is, which is the whole
 * failure mode when the parser miscounts.
 */
export interface RecipeStep {
  id: string
  title: string
  description?: string
  /** Absent means a check-off step. */
  durationSeconds?: number
  /** Referenced from `title` and `description` as `{0}`, `{1}`, … */
  quantities?: Quantity[]
}

export interface Recipe {
  id: string
  title: string
  /** Shown in the list, the way a habit's emoji is. */
  emoji: string
  description?: string
  /**
   * What the stored amounts are *for* — the recipe's own yield, as written. Every quantity
   * on screen is scaled by `chosenServings / servings`, so this is the one number that must
   * never be adjusted by the stepper.
   */
  servings: number
  ingredients: Ingredient[]
  steps: RecipeStep[]
  createdAt: string
  updatedAt: string
}

/** Ids are assigned by the model, so a draft straight out of the parser can be saved as-is. */
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

/** A save replaces the whole recipe — there is no field-by-field patch worth the ambiguity. */
export type UpdateRecipeInput = RecipeInput

/**
 * What the parser returns: a recipe that doesn't exist yet. Identical to `RecipeInput`
 * except that `emoji` and `servings` are always filled in — the parser guesses both rather
 * than leaving the review screen with blanks in it.
 */
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
