import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { climbingApi } from '../services/api'
import type { ClimbingSession, SessionInput } from '../types/climbing'

export const climbingKeys = {
  all: ['climbing'] as const,
  list: () => ['climbing', 'list'] as const,
  detail: (sessionId: string) => ['climbing', sessionId] as const,
}

/** Newest first. The sort key carries a uuid and orders by nothing a reader cares about. */
const byDateDesc = (a: ClimbingSession, b: ClimbingSession) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

/**
 * Every session, whole — the one read the app runs on. Sessions come back complete, so
 * opening one from the list is a cache read rather than another round trip, and the
 * activity grid can be computed without a second endpoint.
 */
function useSessionList() {
  return useQuery({
    queryKey: climbingKeys.list(),
    queryFn: () => climbingApi.list(),
  })
}

/** The list page: the grid, the sessions, and create. */
export function useSessions() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useSessionList()

  const createMutation = useMutation({
    mutationFn: (input: SessionInput) => climbingApi.create(input),
    onSuccess: (session) => {
      // Seeded so the session screen we're about to navigate to renders immediately.
      queryClient.setQueryData(climbingKeys.detail(session.id), session)
      void queryClient.invalidateQueries({ queryKey: climbingKeys.list() })
    },
  })

  const sessions = useMemo(() => [...(data ?? [])].sort(byDateDesc), [data])

  return {
    sessions,
    loading: isPending,
    error: error ? 'Failed to load sessions' : null,
    createSession: createMutation.mutateAsync,
    creating: createMutation.isPending,
  }
}

/**
 * Locations you've climbed at before, most recent first, for the new-session autocomplete.
 *
 * Derived from the list query rather than fetched: the sessions are already loaded, and a
 * "distinct locations" endpoint would be a second source of truth for something the client
 * can see in full.
 */
export function useKnownLocations(): string[] {
  const { data } = useSessionList()

  return useMemo(() => {
    const seen = new Set<string>()
    const locations: string[] = []

    for (const session of [...(data ?? [])].sort(byDateDesc)) {
      const key = session.location.toLowerCase()
      if (session.location && !seen.has(key)) {
        seen.add(key)
        locations.push(session.location)
      }
    }

    return locations
  }, [data])
}

/**
 * The grade system and kind the last session used, so a new one doesn't start by asking a
 * question you almost always answer the same way. Falls back to V-scale integers.
 */
export function useLastGradeSettings(): Pick<ClimbingSession, 'gradeSystem' | 'gradeKind'> {
  const { data } = useSessionList()

  return useMemo(() => {
    const latest = [...(data ?? [])].sort(byDateDesc)[0]
    return {
      gradeSystem: latest?.gradeSystem ?? 'V',
      gradeKind: latest?.gradeKind ?? 'integer',
    }
  }, [data])
}

/**
 * One session, seeded from the list cache when it is warm so navigating in doesn't blank
 * the page while a second request lands.
 */
export function useSession(sessionId: string) {
  const queryClient = useQueryClient()

  const {
    data,
    status,
    fetchStatus,
    error,
    refetch,
  } = useQuery({
    queryKey: climbingKeys.detail(sessionId),
    queryFn: () => climbingApi.get(sessionId),
    initialData: () =>
      queryClient
        .getQueryData<ClimbingSession[]>(climbingKeys.list())
        ?.find((session) => session.id === sessionId),
    /**
     * A 404 is an answer, not a failure to get one — retrying it just delays telling the
     * reader the session is gone. Everything else keeps the app-wide single retry.
     *
     * This also keeps the not-found path off the retry machinery entirely, which matters
     * because a paused retry (the tab is hidden, or the phone is offline) reports
     * `status: 'pending'` with no error, and a screen that waits on that shows a loading
     * skeleton with nothing behind it.
     */
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      return status !== 404 && failureCount < 1
    },
  })

  // A save returns the new session, so the detail cache is written straight from the
  // response; only the list has to be invalidated, and only because its order and its
  // summary lines may have moved.
  const updateMutation = useMutation({
    mutationFn: (input: SessionInput) => climbingApi.update(sessionId, input),
    onSuccess: (session) => {
      queryClient.setQueryData(climbingKeys.detail(sessionId), session)
      void queryClient.invalidateQueries({ queryKey: climbingKeys.list() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => climbingApi.remove(sessionId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: climbingKeys.detail(sessionId) })
      void queryClient.invalidateQueries({ queryKey: climbingKeys.list() })
    },
  })

  /**
   * A 404 is the session actually being gone — deleted here or on another device — and is
   * the only failure the screen should describe as such. Anything else is the app not
   * having been able to ask, which is a different sentence and a different button.
   */
  const httpStatus = (error as { response?: { status?: number } } | null)?.response?.status

  return {
    session: data ?? null,
    // Only while a request is genuinely in flight. A query with no data whose retry is
    // *paused* also reports `status: 'pending'`, and treating that as loading leaves a
    // skeleton spinning forever with nothing behind it — which is what a phone on gym wifi
    // hits, since TanStack pauses retries the moment it believes the connection is gone.
    loading: status === 'pending' && fetchStatus === 'fetching',
    notFound: httpStatus === 404,
    unreachable: !data && (fetchStatus === 'paused' || (status === 'error' && httpStatus !== 404)),
    retry: refetch,
    updateSession: updateMutation.mutateAsync,
    saving: updateMutation.isPending,
    saveFailed: updateMutation.isError,
    deleteSession: deleteMutation.mutateAsync,
  }
}
