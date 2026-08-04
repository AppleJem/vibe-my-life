import { useState, useEffect, useCallback } from 'react'
import { expenseApi } from '../services/api'
import type { Expense } from '../types/expense'

export function useExpenses(yearMonth: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await expenseApi.getExpenses(yearMonth)
      setExpenses(data)
    } catch (err) {
      setError('Failed to load expenses')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const addExpense = async (input: { date: string; amount: number; category: string; note?: string }) => {
    const expense = await expenseApi.createExpense(input)
    setExpenses((prev) => [...prev, expense].sort((a, b) => a.date.localeCompare(b.date)))
    return expense
  }

  const deleteExpense = async (id: string, date: string) => {
    await expenseApi.deleteExpense(id, date)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }

  return {
    expenses,
    loading,
    error,
    refetch: fetchExpenses,
    addExpense,
    deleteExpense,
  }
}
