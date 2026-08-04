import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitApi } from '../services/api'
import type {
  CreateCompletionInput,
  CreateHabitInput,
  UpdateHabitInput,
} from '../types/habit'

export const habitKeys = {
  all: ['habits'] as const,
  list: () => ['habits', 'list'] as const,
  completions: (habitId: string) => ['habits', habitId, 'completions'] as const,
}

/** The habit list, plus create. Editing and logging live on the detail page. */
export function useHabits() {
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: habitKeys.list(),
    queryFn: () => habitApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateHabitInput) => habitApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.list() }),
  })

  return {
    habits: (data ?? []).filter((habit) => !habit.archived),
    loading: isPending,
    error: error ? 'Failed to load habits' : null,
    createHabit: createMutation.mutateAsync,
  }
}

/**
 * One habit and its whole history.
 *
 * The habit itself is read from the list cache when it is warm — navigating in from the
 * list should not blank the header while a second request lands — and falls back to a
 * fetch on a cold load (a deep link, or a refresh on the detail page).
 *
 * Every mutation invalidates the list as well as the history, because logging or
 * un-logging moves `lastCompletedDate`, which is what the list's done-today dot reads.
 */
export function useHabit(habitId: string) {
  const queryClient = useQueryClient()

  const habitQuery = useQuery({
    queryKey: [...habitKeys.all, habitId] as const,
    queryFn: () => habitApi.get(habitId),
    initialData: () =>
      queryClient.getQueryData<Awaited<ReturnType<typeof habitApi.list>>>(habitKeys.list())
        ?.find((habit) => habit.id === habitId),
  })

  const completionsQuery = useQuery({
    queryKey: habitKeys.completions(habitId),
    queryFn: () => habitApi.completions(habitId),
  })

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: habitKeys.completions(habitId) }),
      queryClient.invalidateQueries({ queryKey: habitKeys.list() }),
      queryClient.invalidateQueries({ queryKey: [...habitKeys.all, habitId] }),
    ])
  }, [queryClient, habitId])

  const logMutation = useMutation({
    mutationFn: (input: CreateCompletionInput) => habitApi.log(habitId, input),
    onSuccess: invalidate,
  })

  const unlogMutation = useMutation({
    mutationFn: (timestamp: string) => habitApi.unlog(habitId, timestamp),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateHabitInput) => habitApi.update(habitId, input),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => habitApi.remove(habitId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  })

  return {
    habit: habitQuery.data ?? null,
    completions: completionsQuery.data ?? [],
    loading: habitQuery.isPending || completionsQuery.isPending,
    notFound: habitQuery.isError,
    error: completionsQuery.error ? 'Failed to load history' : null,
    log: logMutation.mutateAsync,
    unlog: unlogMutation.mutateAsync,
    updateHabit: updateMutation.mutateAsync,
    deleteHabit: deleteMutation.mutateAsync,
  }
}
