import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitApi, habitGroupApi } from '../services/api'
import { addDays, normaliseTag } from '../utils/habit'
import { localToday } from '../utils/recurring'
import type {
  Completion,
  CreateCompletionInput,
  CreateHabitInput,
  CreateHabitGroupInput,
  UpdateHabitInput,
  UpdateHabitGroupInput,
} from '../types/habit'

export const habitKeys = {
  all: ['habits'] as const,
  /** Habits *and* groups — one request serves both. */
  list: () => ['habits', 'list'] as const,
  completions: (habitId: string) => ['habits', habitId, 'completions'] as const,
  /** Every habit's recent history, for the list strip. */
  recent: (since: string) => ['habits', 'recent', since] as const,
}

/**
 * The one query behind the whole feature. Every other hook here reads it rather than
 * fetching, so the list page, the group page, and the form's group picker share a single
 * round trip — a group page that loaded its own habits would reintroduce a request per
 * group over data the list already had.
 */
function useHabitList() {
  return useQuery({
    queryKey: habitKeys.list(),
    queryFn: () => habitApi.list(),
  })
}

/** The habit list and its groups, plus create. Editing and logging live on the detail page. */
export function useHabits() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useHabitList()

  const createMutation = useMutation({
    mutationFn: (input: CreateHabitInput) => habitApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.list() }),
  })

  return {
    habits: (data?.habits ?? []).filter((habit) => !habit.archived),
    groups: data?.groups ?? [],
    loading: isPending,
    error: error ? 'Failed to load habits' : null,
    createHabit: createMutation.mutateAsync,
  }
}

/**
 * Group writes. Reads come off the same list query as everything else, so creating,
 * renaming, reordering, or deleting a group all invalidate exactly one key.
 */
export function useHabitGroups() {
  const queryClient = useQueryClient()
  const { data } = useHabitList()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: habitKeys.list() })

  const createMutation = useMutation({
    mutationFn: (input: CreateHabitGroupInput) => habitGroupApi.create(input),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHabitGroupInput }) =>
      habitGroupApi.update(id, input),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitGroupApi.remove(id),
    onSuccess: invalidate,
  })

  return {
    groups: data?.groups ?? [],
    createGroup: createMutation.mutateAsync,
    updateGroup: updateMutation.mutateAsync,
    deleteGroup: deleteMutation.mutateAsync,
  }
}

/**
 * The last `days` days of every habit's history, indexed by habit id — what the list
 * page's week strip draws.
 *
 * One request for the whole list rather than one per habit: the server can pull every
 * completion in the user's partition in a single query, and the list would otherwise fire
 * N requests each dragging back a full history to use seven days of it.
 */
export function useRecentCompletions(days = 7) {
  const since = addDays(localToday(), -(days - 1))

  const { data, error } = useQuery({
    queryKey: habitKeys.recent(since),
    queryFn: () => habitApi.recentCompletions(since),
  })

  const byHabit = useMemo(() => {
    const map = new Map<string, Completion[]>()

    for (const completion of data ?? []) {
      const existing = map.get(completion.habitId)
      if (existing) existing.push(completion)
      else map.set(completion.habitId, [completion])
    }

    return map
  }, [data])

  return { byHabit, error: error ? 'Failed to load recent history' : null }
}

/**
 * The tags already in use, for the form's autocomplete. Derived from the list query rather
 * than stored anywhere — every habit is already loaded, so the vocabulary is free. Tags are
 * normalised on the way out so anything typed before the rule existed still suggests in its
 * canonical shape.
 *
 * Groups used to be derived here too. They are stored entities now, so they come from
 * `useHabitGroups()` instead.
 */
export function useHabitTaxonomy() {
  const { data } = useHabitList()

  return useMemo(() => {
    const tags = new Set<string>()

    for (const habit of data?.habits ?? []) {
      for (const tag of habit.tags) {
        const normalised = normaliseTag(tag)
        if (normalised) tags.add(normalised)
      }
    }

    return { tags: [...tags].sort() }
  }, [data])
}

/**
 * One habit and its whole history.
 *
 * The habit itself is read from the list cache when it is warm — navigating in from the
 * list should not blank the header while a second request lands — and falls back to a
 * fetch on a cold load (a deep link, or a refresh on the detail page).
 *
 * Every mutation invalidates the list and the recent-history query as well as this
 * habit's own, because logging or un-logging changes what the list page's week strip
 * draws.
 */
export function useHabit(habitId: string) {
  const queryClient = useQueryClient()

  const habitQuery = useQuery({
    queryKey: [...habitKeys.all, habitId] as const,
    queryFn: () => habitApi.get(habitId),
    initialData: () =>
      queryClient.getQueryData<Awaited<ReturnType<typeof habitApi.list>>>(habitKeys.list())
        ?.habits.find((habit) => habit.id === habitId),
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
      // The list's week strip reads this, so logging has to repaint it too.
      queryClient.invalidateQueries({ queryKey: ['habits', 'recent'] }),
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
