import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { IngredientList } from '../../../components/Cooking/IngredientList'
import { RecipeForm } from '../../../components/Cooking/RecipeForm'
import { ServingsStepper } from '../../../components/Cooking/ServingsStepper'
import { StepList } from '../../../components/Cooking/StepList'
import { UnitToggle } from '../../../components/Cooking/UnitToggle'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { useRecipe } from '../../../hooks/useRecipes'
import { hasConvertible, type UnitSystem } from '../../../utils/units'
import type { RecipeInput } from '../../../types/recipe'

export const Route = createFileRoute('/_authenticated/cooking/$recipeId')({
  component: RecipePage,
})

/**
 * One recipe, read the way it is going to be cooked.
 *
 * Two controls sit above everything: how many servings, and which system of units. Both are
 * views over the stored recipe — neither writes anything — and both apply to the ingredient
 * list and the steps together. A recipe scaled for six with the steps still written for four
 * would be worse than no scaling at all, which is why every amount on the page, wherever it
 * sits, goes through the same pair of transformations.
 *
 * The unit choice is remembered across recipes, because it is a fact about the reader rather
 * than about any one recipe. The serving count is not: it belongs to the meal you are cooking
 * tonight, and it starts from what the recipe was written for.
 */
function RecipePage() {
  const { recipeId } = Route.useParams()
  const navigate = useNavigate()
  const { recipe, loading, notFound, updateRecipe, deleteRecipe } = useRecipe(recipeId)

  const [system, setSystem] = useLocalStorage<UnitSystem>('cooking:unitSystem', 'us')
  /** Null until the recipe has loaded and told us what it was written for. */
  const [servings, setServings] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  /**
   * Checked-off steps, per recipe. Kept in storage rather than component state because a
   * cooking session outlives the page: the phone sleeps, iOS reloads the PWA, and losing your
   * place halfway through a method is worse than finding old checks next time — which the
   * progress line makes obvious and one tap clears.
   */
  const [doneList, setDoneList] = useLocalStorage<string[]>(`cooking:done:${recipeId}`, [])

  /**
   * Only ids that are still steps of this recipe. An edit that deletes a checked step leaves
   * its id in storage; reading through this means it can't inflate "3 of 2 done".
   */
  const doneIds = useMemo(
    () => new Set(doneList.filter((id) => recipe?.steps.some((step) => step.id === id))),
    [doneList, recipe]
  )

  const toggleDone = (stepId: string) =>
    setDoneList((current) =>
      current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId]
    )

  /** Whether the toggle would change anything at all on this particular page. */
  const convertible = useMemo(
    () =>
      recipe
        ? hasConvertible([
          ...recipe.ingredients.map((ingredient) => ingredient.quantity),
          ...recipe.steps.flatMap((step) => step.quantities ?? []),
        ])
        : false,
    [recipe]
  )

  if (loading && !recipe) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-2/3 bg-zinc-800 rounded animate-pulse" />
        <div className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (notFound || !recipe) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">That recipe is gone.</p>
        <button
          onClick={() => navigate({ to: '/cooking' })}
          className="mt-4 text-sm font-medium text-amber-400"
        >
          Back to recipes
        </button>
      </div>
    )
  }

  const chosenServings = servings ?? recipe.servings
  // The one number the whole page is scaled by. The recipe's own yield is the denominator,
  // which is why the stepper can never be allowed to change it.
  const factor = chosenServings / recipe.servings

  const handleSave = async (input: RecipeInput) => {
    setIsSaving(true)
    try {
      await updateRecipe(input)
      setIsEditing(false)
      // The edit may have re-based the yield, and a serving count picked against the old one
      // no longer means what it did.
      setServings(null)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteRecipe()
      navigate({ to: '/cooking' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <RecipeForm
        initial={recipe}
        heading="Edit recipe"
        saveLabel="Save changes"
        isSaving={isSaving}
        onSave={handleSave}
        onClose={() => setIsEditing(false)}
        onDelete={handleDelete}
        isDeleting={isDeleting}

      />
    )
  }

  return (
    <>
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={() => navigate({ to: '/cooking' })}
          className="mt-1 text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-100">
            <span className="mr-2">{recipe.emoji}</span>
            {recipe.title}
          </h2>
          {recipe.description && (
            <p className="mt-1 text-sm text-zinc-500">{recipe.description}</p>
          )}
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="mt-1 shrink-0 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Edit
        </button>
      </div>

      {/* Both controls in one bar, and one toggle for the whole recipe: ingredients and steps
          are read together, and mixing systems between them is what the single switch exists
          to prevent. */}
      <div className="sticky top-[73px] z-30 -mx-4 mb-6 border-y border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-sm">
        <ServingsStepper
          value={chosenServings}
          base={recipe.servings}
          onChange={setServings}
        />

        <div className="mt-3 flex items-center gap-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Units</p>
          <div className="ml-auto">
            <UnitToggle value={system} onChange={setSystem} enabled={convertible} />
          </div>
        </div>

        {convertible && (
          <p className="mt-2 text-right text-[11px] text-zinc-600">
            Teaspoons and tablespoons stay as they are.
          </p>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-zinc-300">Ingredients</h3>
      <IngredientList ingredients={recipe.ingredients} factor={factor} system={system} />

      <div className="mt-8 mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-zinc-300">Steps</h3>
        {doneIds.size > 0 && (
          <>
            <span className="text-xs text-zinc-500">
              {doneIds.size === recipe.steps.length
                ? 'All done'
                : `${doneIds.size} of ${recipe.steps.length} done`}
            </span>
            <button
              onClick={() => setDoneList([])}
              className="ml-auto text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          </>
        )}
      </div>
      <StepList
        steps={recipe.steps}
        factor={factor}
        system={system}
        doneIds={doneIds}
        onToggleDone={toggleDone}
      />


    </>
  )
}
