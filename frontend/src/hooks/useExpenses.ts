import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseApi } from '../services/api'
import type { CreateExpenseInput, UpdateExpenseInput } from '../types/expense'

export const expenseKeys = {
  all: ['expenses'] as const,
  month: (yearMonth: string) => ['expenses', yearMonth] as const,
}

/** `2026-08-04` -> `2026-08`. Expenses are partitioned by month server-side. */
const monthOf = (date: string) => date.slice(0, 7)

export function useExpenses(yearMonth: string) {
  const queryClient = useQueryClient()

  const { data, isPending, error, refetch } = useQuery({
    queryKey: expenseKeys.month(yearMonth),
    queryFn: () => expenseApi.getExpenses(yearMonth),
  })

  // Awaited by the mutations below so mutateAsync only resolves once the list
  // is correct — callers can keep their pending UI up until then.
  const invalidateMonths = useCallback(
    (months: string[]) =>
      Promise.all(
        [...new Set(months)].map((month) =>
          queryClient.invalidateQueries({ queryKey: expenseKeys.month(month) })
        )
      ),
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: (input: CreateExpenseInput) => expenseApi.createExpense(input),
    // The new expense may be dated outside the month on screen.
    onSuccess: (expense) => invalidateMonths([monthOf(expense.date)]),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, date, updates }: { id: string; date: string; updates: UpdateExpenseInput }) =>
      expenseApi.updateExpense(id, date, updates),
    // Editing the date moves the expense between months, so both are affected.
    onSuccess: (expense, { date }) => invalidateMonths([monthOf(date), monthOf(expense.date)]),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => expenseApi.deleteExpense(id, date),
    onSuccess: (_result, { date }) => invalidateMonths([monthOf(date)]),
  })

  const addExpense = useCallback(
    (input: CreateExpenseInput) => createMutation.mutateAsync(input),
    [createMutation.mutateAsync]
  )

  const updateExpense = useCallback(
    (id: string, date: string, updates: UpdateExpenseInput) =>
      updateMutation.mutateAsync({ id, date, updates }),
    [updateMutation.mutateAsync]
  )

  const deleteExpense = useCallback(
    async (id: string, date: string) => {
      await deleteMutation.mutateAsync({ id, date })
    },
    [deleteMutation.mutateAsync]
  )

  return {
    expenses: data ?? [],
    loading: isPending,
    error: error ? 'Failed to load expenses' : null,
    refetch,
    addExpense,
    updateExpense,
    deleteExpense,
  }
}
