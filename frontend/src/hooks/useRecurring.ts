import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recurringApi } from '../services/api'
import { expenseKeys } from './useExpenses'
import { localToday } from '../utils/recurring'
import type { PropagateScope, RecurringRuleInput } from '../types/expense'

export const recurringKeys = {
  all: ['recurring'] as const,
  rules: () => ['recurring', 'rules'] as const,
  /** Keyed by the local day so leaving the app open past midnight re-runs catch-up. */
  catchUp: (today: string) => ['recurring', 'catch-up', today] as const,
}

/**
 * Invalidating by month is not enough on its own here: a rule edit can rewrite rows in
 * months the response didn't mention (nothing tracks which months a rule has ever
 * touched without a full scan), so the whole expense cache is dropped when a rule
 * changes. Catch-up, which knows exactly what it wrote, invalidates precisely.
 */
export function useRecurringRules() {
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: recurringKeys.rules(),
    queryFn: () => recurringApi.list(),
  })

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: recurringKeys.rules() }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.all }),
    ])
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (input: RecurringRuleInput) => recurringApi.create(input, localToday()),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
      propagate,
      from,
    }: {
      id: string
      input: RecurringRuleInput
      propagate: PropagateScope
      from?: string
    }) => recurringApi.update(id, input, { propagate, from, today: localToday() }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteItems }: { id: string; deleteItems: boolean }) =>
      recurringApi.remove(id, deleteItems),
    onSuccess: invalidate,
  })

  return {
    rules: data ?? [],
    loading: isPending,
    error: error ? 'Failed to load recurring items' : null,
    createRule: createMutation.mutateAsync,
    updateRule: updateMutation.mutateAsync,
    deleteRule: deleteMutation.mutateAsync,
  }
}

/**
 * Materialises everything the rules owe, once per local day per session.
 *
 * A query rather than a mutation on purpose: the key gives per-session dedupe for free
 * across remounts, and re-fires by itself at midnight. Failure is swallowed — the ledger
 * has to render even when catch-up is down.
 */
export function useRecurringCatchUp() {
  const queryClient = useQueryClient()
  const today = localToday()

  useQuery({
    queryKey: recurringKeys.catchUp(today),
    queryFn: async () => {
      const result = await recurringApi.run(today)

      await Promise.all(
        result.months.map((month) =>
          queryClient.invalidateQueries({ queryKey: expenseKeys.month(month) })
        )
      )
      if (result.created.length > 0) {
        await queryClient.invalidateQueries({ queryKey: recurringKeys.rules() })
      }

      return result
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
