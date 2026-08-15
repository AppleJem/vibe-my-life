import { useState, useEffect, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { expenseApi } from '../services/api'
import { expenseKeys } from './useExpenses'
import type { Expense } from '../types/expense'

const BATCH_SIZE = 5

/** Generate inclusive list of YYYY-MM strings between two endpoints. */
function monthRange(start: string, end: string): string[] {
  const months: string[] = []
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return months
}

interface UseExpenseSearchOptions {
  enabled: boolean
  startMonth: string
  endMonth: string
  query: string
}

export function useExpenseSearch({
  enabled,
  startMonth,
  endMonth,
  query,
}: UseExpenseSearchOptions) {
  const months = useMemo(
    () => (enabled ? monthRange(startMonth, endMonth) : []),
    [enabled, startMonth, endMonth]
  )

  // Track which batch we're currently fetching (0-indexed)
  const [currentBatch, setCurrentBatch] = useState(0)

  // Reset batch when month range changes
  useEffect(() => {
    setCurrentBatch(0)
  }, [startMonth, endMonth])

  const queries = useQueries({
    queries: months.map((month, i) => ({
      queryKey: expenseKeys.month(month),
      queryFn: () => expenseApi.getExpenses(month),
      enabled: enabled && Math.floor(i / BATCH_SIZE) <= currentBatch,
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  })

  // Advance to next batch when current batch finishes
  useEffect(() => {
    if (!enabled || months.length === 0) return

    const batchStart = currentBatch * BATCH_SIZE
    const batchEnd = Math.min(batchStart + BATCH_SIZE, months.length)
    const batchQueries = queries.slice(batchStart, batchEnd)

    const allSettled = batchQueries.every((q) => !q.isFetching)
    const anySuccess = batchQueries.some((q) => q.isSuccess)

    if (allSettled && anySuccess && batchEnd < months.length) {
      setCurrentBatch((prev) => prev + 1)
    }
  }, [enabled, months.length, currentBatch, queries])

  // Aggregate all loaded expenses
  const allExpenses = useMemo(() => {
    const result: Expense[] = []
    for (const q of queries) {
      if (q.data) result.push(...q.data)
    }
    return result
  }, [queries])

  // Client-side substring filter
  const results = useMemo(() => {
    if (!query.trim()) return allExpenses

    const lower = query.toLowerCase()
    return allExpenses.filter(
      (e) =>
        (e.note && e.note.toLowerCase().includes(lower)) ||
        (e.remarks && e.remarks.toLowerCase().includes(lower))
    )
  }, [allExpenses, query])

  // Sort by date descending
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.date.localeCompare(a.date)),
    [results]
  )

  // Progress tracking
  const loadedCount = queries.filter((q) => q.isSuccess).length
  const totalCount = months.length
  const isSearching = queries.some((q) => q.isFetching)

  return {
    results: sortedResults,
    isSearching,
    loadedCount,
    totalCount,
  }
}
