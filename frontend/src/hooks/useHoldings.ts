import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { holdingApi } from '../services/api'
import type { CreateHoldingInput, UpdateHoldingInput } from '../types/holding'

export const holdingKeys = {
  all: ['holdings'] as const,
}

/**
 * The planning tab's data. Nothing here touches `expenseKeys` — holdings are a separate
 * item type in the table and no expense row is derived from one, so a holding write can
 * never make a month stale.
 */
export function useHoldings() {
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: holdingKeys.all,
    queryFn: () => holdingApi.list(),
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: holdingKeys.all }),
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: (input: CreateHoldingInput) => holdingApi.create(input),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateHoldingInput }) =>
      holdingApi.update(id, updates),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => holdingApi.remove(id),
    onSuccess: invalidate,
  })

  return {
    holdings: data ?? [],
    loading: isPending,
    error: error ? 'Failed to load holdings' : null,
    createHolding: createMutation.mutateAsync,
    updateHolding: updateMutation.mutateAsync,
    deleteHolding: deleteMutation.mutateAsync,
  }
}
