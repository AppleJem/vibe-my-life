import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRecipes } from '../../../hooks/useRecipes'
import { formatDurationLong } from '../../../utils/units'
import type { Recipe } from '../../../types/recipe'

export const Route = createFileRoute('/_authenticated/cooking/')({
  component: CookingPage,
})

/** The hands-off time a recipe adds up to, or null when no step carries a timer. */
function totalTimerSeconds(recipe: Recipe): number | null {
  const total = recipe.steps.reduce((sum, step) => sum + (step.durationSeconds ?? 0), 0)
  return total > 0 ? total : null
}

function CookingPage() {
  const navigate = useNavigate()
  const { recipes, loading, error } = useRecipes()

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/apps' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Cooking</h2>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🍳</p>
          <p className="text-zinc-400">No recipes yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Photograph a page or paste one in — it comes back as a list and steps.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recipes.map((recipe) => {
            const timers = totalTimerSeconds(recipe)

            return (
              <li key={recipe.id}>
                <button
                  onClick={() =>
                    navigate({ to: '/cooking/$recipeId', params: { recipeId: recipe.id } })
                  }
                  className="w-full flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-left hover:bg-zinc-800 transition-colors"
                >
                  <span className="text-2xl shrink-0">{recipe.emoji}</span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">{recipe.title}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {recipe.ingredients.length} ingredients · {recipe.steps.length} steps
                      {timers !== null && ` · ${formatDurationLong(timers)} of timers`}
                    </p>
                  </div>

                  {/* The yield as written. The reader's own serving count is a view on the
                      detail page and deliberately not remembered here. */}
                  <span className="shrink-0 text-xs text-amber-400">
                    serves {recipe.servings}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button
        onClick={() => navigate({ to: '/cooking/new' })}
        aria-label="New recipe"
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25 flex items-center justify-center text-zinc-950 text-3xl"
      >
        +
      </button>
    </>
  )
}
