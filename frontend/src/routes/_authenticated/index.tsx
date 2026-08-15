import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { MonthHeader } from '../../components/ExpenseTracker/MonthHeader'
import { ExpenseList } from '../../components/ExpenseTracker/ExpenseList'
import { SwipeContainer } from '../../components/ExpenseTracker/SwipeContainer'
import { AddExpenseModal } from '../../components/ExpenseTracker/AddExpenseModal/AddExpenseModal'
import { CategoryBreakdown } from '../../components/ExpenseTracker/CategoryBreakdown/CategoryBreakdown'
import { ViewTabs, type DashboardView } from '../../components/ExpenseTracker/ViewTabs'
import { SearchBar } from '../../components/ExpenseTracker/SearchBar'
import { SearchResults } from '../../components/ExpenseTracker/SearchResults'
import { useExpenses } from '../../hooks/useExpenses'
import { useDebounce } from '../../hooks/useDebounce'
import { useExpenseSearch } from '../../hooks/useExpenseSearch'
import { Layout } from '../../components/Layout'
import { splitByType, sumOf } from '../../utils/transaction'
import type { CreateExpenseInput, UpdateExpenseInput, Expense } from '../../types/expense'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

/** Returns YYYY-MM for the current month minus `monthsAgo` months. */
function monthsAgo(monthsAgo: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function DashboardPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [view, setView] = useState<DashboardView>('list')

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStartMonth, setSearchStartMonth] = useState(() => monthsAgo(2))
  const [searchEndMonth, setSearchEndMonth] = useState(() => monthsAgo(0))

  const debouncedQuery = useDebounce(searchQuery, 300)

  const { expenses, loading, deleteExpense, addExpense, updateExpense } = useExpenses(yearMonth)

  const {
    results: searchResults,
    isSearching,
    loadedCount,
    totalCount,
  } = useExpenseSearch({
    enabled: isSearchOpen,
    startMonth: searchStartMonth,
    endMonth: searchEndMonth,
    query: debouncedQuery,
  })

  // One query returns the whole month, both directions; the split is a render concern.
  const split = splitByType(expenses)
  const incomeTotal = sumOf(split.income)
  const expenseTotal = sumOf(split.expenses)

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

  const handleUpdateExpense = async (id: string, date: string, updates: UpdateExpenseInput) => {
    await updateExpense(id, date, updates)
  }

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedExpense(null)
  }

  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (!prev) {
        // Opening search — reset to default range
        setSearchStartMonth(monthsAgo(2))
        setSearchEndMonth(monthsAgo(0))
        setSearchQuery('')
      }
      return !prev
    })
  }, [])

  const searchContent = (
    <SearchBar
      query={searchQuery}
      startMonth={searchStartMonth}
      endMonth={searchEndMonth}
      onQueryChange={setSearchQuery}
      onStartMonthChange={setSearchStartMonth}
      onEndMonthChange={setSearchEndMonth}
      onClose={handleToggleSearch}
    />
  )

  return (
    <Layout
      showSearch={isSearchOpen}
      onSearchToggle={handleToggleSearch}
      searchContent={searchContent}
    >
      {isSearchOpen ? (
        <SearchResults
          expenses={searchResults}
          loading={isSearching}
          loadedCount={loadedCount}
          totalCount={totalCount}
          query={debouncedQuery}
          onDelete={deleteExpense}
          onExpenseClick={handleExpenseClick}
        />
      ) : (
        <>
          <SwipeContainer onSwipeLeft={goToNextMonth} onSwipeRight={goToPreviousMonth}>
            <MonthHeader
              yearMonth={yearMonth}
              income={incomeTotal}
              expense={expenseTotal}
              onPrevious={goToPreviousMonth}
              onNext={goToNextMonth}
            />

            {view === 'list' ? (
              <ExpenseList
                expenses={expenses}
                loading={loading}
                onDelete={deleteExpense}
                onExpenseClick={handleExpenseClick}
              />
            ) : (
              <CategoryBreakdown
                expenses={expenses}
                loading={loading}
                onDelete={deleteExpense}
                onExpenseClick={handleExpenseClick}
              />
            )}
          </SwipeContainer>

          {/* FAB - Add expense */}
          <button
            onClick={() => {
              setSelectedExpense(null)
              setIsModalOpen(true)
            }}
            className="fixed bottom-24 right-6 w-14 h-14 bg-pink-500 rounded-full shadow-lg shadow-pink-500/25 flex items-center justify-center hover:shadow-pink-500/40 transition-shadow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </>
      )}

      {/* Add/Edit Expense Modal */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddExpense}
        expense={selectedExpense}
        onUpdate={handleUpdateExpense}
      />

      <ViewTabs value={view} onChange={setView} />
    </Layout>
  )
}
