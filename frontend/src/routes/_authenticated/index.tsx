import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { MonthHeader } from '../../components/ExpenseTracker/MonthHeader'
import { ExpenseList } from '../../components/ExpenseTracker/ExpenseList'
import { SwipeContainer } from '../../components/ExpenseTracker/SwipeContainer'
import { AddExpenseModal } from '../../components/ExpenseTracker/AddExpenseModal/AddExpenseModal'
import { useExpenses } from '../../hooks/useExpenses'
import type { CreateExpenseInput } from '../../types/expense'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

function DashboardPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { expenses, loading, deleteExpense, addExpense } = useExpenses(yearMonth)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  const goToPreviousMonth = useCallback(() => {
    setYearMonth((prev) => {
      const [year, month] = prev.split('-').map(Number)
      const date = new Date(year, month - 2)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setYearMonth((prev) => {
      const [year, month] = prev.split('-').map(Number)
      const date = new Date(year, month)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const handleAddExpense = async (input: CreateExpenseInput) => {
    await addExpense(input)
  }

  return (
    <Layout>
      <SwipeContainer onSwipeLeft={goToNextMonth} onSwipeRight={goToPreviousMonth}>
        <MonthHeader
          yearMonth={yearMonth}
          total={total}
          onPrevious={goToPreviousMonth}
          onNext={goToNextMonth}
        />

        <ExpenseList
          expenses={expenses}
          loading={loading}
          onDelete={deleteExpense}
        />
      </SwipeContainer>

      {/* FAB - Add expense */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-rose-400 to-violet-400 rounded-full shadow-lg shadow-rose-500/25 flex items-center justify-center hover:shadow-rose-500/40 transition-shadow"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddExpense}
      />
    </Layout>
  )
}
