import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitActionApi, habitApi, habitGroupApi } from '../services/api'
import { addDays, normaliseTag } from '../utils/habit'
import { localToday } from '../utils/recurring'
import type {
  Completion,
  CreateCompletionInput,
  UpdateCompletionInput,
  CreateHabitInput,
  CreateHabitGroupInput,
  UpdateHabitInput,
  UpdateHabitGroupInput,
  SaveActionListInput,
} from '../types/habit'

export const habitKeys = {
  all: ['habits'] as const,
  /** Habits *and* groups — one request serves both. */
  list: () => ['habits', 'list'] as const,
  completions: (habitId: string) => ['habits', habitId, 'completions'] as const,
  /** Every habit's recent history, for the list strip. */
  recent: (since: string) => ['habits', 'recent', since] as const,
  /** One habit's routine — read only by the detail page and exercise mode. */
  actions: (habitId: string) => ['habits', habitId, 'actions'] as const,
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

/** The archived remainder of the same list query — what `useHabits()` filters out. */
export function useArchivedHabits() {
  const { data, isPending, error } = useHabitList()

  return {
    habits: (data?.habits ?? []).filter((habit) => habit.archived),
    groups: data?.groups ?? [],
    loading: isPending,
    error: error ? 'Failed to load habits' : null,
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

  const editCompletionMutation = useMutation({
    mutationFn: ({ timestamp, input }: { timestamp: string; input: UpdateCompletionInput }) =>
      habitApi.updateCompletion(habitId, timestamp, input),
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
    editCompletion: editCompletionMutation.mutateAsync,
    updateHabit: updateMutation.mutateAsync,
    deleteHabit: deleteMutation.mutateAsync,
  }
}

/**
 * One habit's routine: the steps exercise mode walks through, and the editor behind them.
 *
 * Kept out of `useHabit()` deliberately — the detail page needs to know whether a routine
 * exists to decide whether to offer exercise mode at all, but nothing else in the app reads
 * one, so it is a query of its own rather than another field on the list everything shares.
 *
 * `actionList` is null both for a habit that never had a routine and for one whose last
 * step was just removed; the two are the same state, and `hasActions` is what the page
 * actually asks.
 */
export function useActionList(habitId: string) {
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: habitKeys.actions(habitId),
    queryFn: () => habitActionApi.get(habitId),
  })

  // A save returns the new list (or null when it emptied), so the cache is written
  // straight from the response rather than invalidated into a second round trip.
  const onSettled = (actionList: Awaited<ReturnType<typeof habitActionApi.get>>) =>
    queryClient.setQueryData(habitKeys.actions(habitId), actionList)

  const saveMutation = useMutation({
    mutationFn: (input: SaveActionListInput) => habitActionApi.save(habitId, input),
    onSuccess: onSettled,
  })

  const deleteMutation = useMutation({
    mutationFn: () => habitActionApi.remove(habitId),
    onSuccess: () => onSettled(null),
  })

  return {
    actionList: data ?? null,
    items: data?.items ?? [],
    /** False while loading too, so the exercise button appears rather than flickering away. */
    hasActions: (data?.items.length ?? 0) > 0,
    loading: isPending,
    error: error ? 'Failed to load the action list' : null,
    saveActions: saveMutation.mutateAsync,
    deleteActions: deleteMutation.mutateAsync,
  }
}
