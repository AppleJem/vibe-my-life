import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recipeApi } from '../services/api'
import type { RecipeInput } from '../types/recipe'

export const recipeKeys = {
  all: ['recipes'] as const,
  list: () => ['recipes', 'list'] as const,
  detail: (recipeId: string) => ['recipes', recipeId] as const,
}

/**
 * Every recipe, whole — the one read the app runs on. Recipes come back complete, so
 * opening one from the list is a cache read rather than another round trip; the detail
 * query below exists for a deep link or a refresh, not for the normal path in.
 */
function useRecipeList() {
  return useQuery({
    queryKey: recipeKeys.list(),
    queryFn: () => recipeApi.list(),
  })
}

/** The list page: newest first, plus create. */
export function useRecipes() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useRecipeList()

  const createMutation = useMutation({
    mutationFn: (input: RecipeInput) => recipeApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recipeKeys.list() }),
  })

  return {
    // Sorted here rather than by the sort key, which carries a uuid and orders by nothing
    // a reader cares about.
    recipes: [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    loading: isPending,
    error: error ? 'Failed to load recipes' : null,
    createRecipe: createMutation.mutateAsync,
  }
}

/**
 * One recipe, seeded from the list cache when it is warm so navigating in doesn't blank the
 * page while a second request lands.
 */
export function useRecipe(recipeId: string) {
  const queryClient = useQueryClient()

  const { data, isPending, isError } = useQuery({
    queryKey: recipeKeys.detail(recipeId),
    queryFn: () => recipeApi.get(recipeId),
    initialData: () =>
      queryClient
        .getQueryData<Awaited<ReturnType<typeof recipeApi.list>>>(recipeKeys.list())
        ?.find((recipe) => recipe.id === recipeId),
  })

  // A save returns the new recipe, so the detail cache is written straight from the
  // response; only the list has to be invalidated, and only because its order and its
  // summary lines may have moved.
  const updateMutation = useMutation({
    mutationFn: (input: RecipeInput) => recipeApi.update(recipeId, input),
    onSuccess: (recipe) => {
      queryClient.setQueryData(recipeKeys.detail(recipeId), recipe)
      void queryClient.invalidateQueries({ queryKey: recipeKeys.list() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => recipeApi.remove(recipeId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: recipeKeys.detail(recipeId) })
      void queryClient.invalidateQueries({ queryKey: recipeKeys.list() })
    },
  })

  return {
    recipe: data ?? null,
    loading: isPending,
    notFound: isError,
    updateRecipe: updateMutation.mutateAsync,
    deleteRecipe: deleteMutation.mutateAsync,
  }
}
