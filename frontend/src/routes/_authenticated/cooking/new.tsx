import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ParsingOverlay } from '../../../components/Cooking/ParsingOverlay'
import { RecipeForm } from '../../../components/Cooking/RecipeForm'
import { RecipeSource } from '../../../components/Cooking/RecipeSource'
import { useRecipes } from '../../../hooks/useRecipes'
import { recipeApi } from '../../../services/api'
import type { RecipeDraft, RecipeInput } from '../../../types/recipe'

export const Route = createFileRoute('/_authenticated/cooking/new')({
  component: NewRecipePage,
})

/**
 * Adding a recipe, in two acts: read it, then check it.
 *
 * The draft between them is local state rather than a router search param — it is a whole
 * recipe, and a URL is the wrong place for one. The cost is that a refresh mid-review loses
 * the parse, which is the same cost as a refresh mid-form and worth the clean URL.
 *
 * A failed parse leaves the source screen exactly as it was, photos still attached, so
 * retrying is one tap rather than a re-pick.
 */
function NewRecipePage() {
  const navigate = useNavigate()
  const { createRecipe } = useRecipes()

  /** Null until a recipe has been read or the form was opened blank. */
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [imageCount, setImageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleParse = async ({ text, images }: { text?: string; images: File[] }) => {
    setError(null)
    setImageCount(images.length)
    setIsParsing(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const parsed = await recipeApi.parse({ text, images }, controller.signal)
      setDraft(parsed)
      setIsReviewing(true)
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        // Cancelled by the user — the source screen is still there, untouched.
      } else {
        setError(
          err.response?.data?.error ??
            'Could not read that recipe. Try a clearer photo, or paste the text.'
        )
      }
    } finally {
      setIsParsing(false)
      abortRef.current = null
    }
  }

  const handleSave = async (input: RecipeInput) => {
    setIsSaving(true)
    try {
      const recipe = await createRecipe(input)
      // Straight into it — the next thing you want is to cook the thing.
      navigate({ to: '/cooking/$recipeId', params: { recipeId: recipe.id } })
    } finally {
      setIsSaving(false)
    }
  }

  if (isReviewing) {
    return (
      <RecipeForm
        initial={draft}
        heading={draft ? 'Check the recipe' : 'New recipe'}
        blurb={
          draft
            ? 'Read off the source — fix anything that came through wrong before it is saved.'
            : undefined
        }
        saveLabel="Save recipe"
        isSaving={isSaving}
        onSave={handleSave}
        // Back out of a parsed draft to the source screen, and out of a blank one to the list:
        // in the first case there is something to re-read, in the second there never was.
        onClose={() =>
          draft ? setIsReviewing(false) : navigate({ to: '/cooking' })
        }
      />
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate({ to: '/cooking' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Add a recipe</h2>
      </div>

      <p className="text-xs text-zinc-600 mb-6 pl-8">
        Photos and text both turn into an ingredient list with amounts, and steps you can put
        a timer on.
      </p>

      <RecipeSource
        isParsing={isParsing}
        error={error}
        onParse={handleParse}
        onWriteByHand={() => {
          setDraft(null)
          setIsReviewing(true)
        }}
      />

      {isParsing && (
        <ParsingOverlay
          imageCount={imageCount}
          onCancel={() => abortRef.current?.abort()}
        />
      )}
    </>
  )
}
