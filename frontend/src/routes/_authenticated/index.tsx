import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useRef, lazy, Suspense } from 'react'
import { MonthHeader } from '../../components/ExpenseTracker/MonthHeader'
import { ExpenseList } from '../../components/ExpenseTracker/ExpenseList'
import { SwipeContainer } from '../../components/ExpenseTracker/SwipeContainer'
import { AddExpenseModal } from '../../components/ExpenseTracker/AddExpenseModal/AddExpenseModal'
import { ViewTabs, type DashboardView } from '../../components/ExpenseTracker/ViewTabs'
import { ImagePickerButton } from '../../components/ExpenseTracker/ImagePickerButton'
import { ScreenshotLoadingOverlay } from '../../components/ExpenseTracker/ScreenshotLoadingOverlay'
import { useExpenses } from '../../hooks/useExpenses'
import { splitByType, sumOf } from '../../utils/transaction'
import { screenshotApi } from '../../services/api'
import type { CreateExpenseInput, UpdateExpenseInput, Expense } from '../../types/expense'

// Lazy-load CategoryBreakdown — it pulls in recharts (~200KB)
const CategoryBreakdown = lazy(() =>
  import('../../components/ExpenseTracker/CategoryBreakdown/CategoryBreakdown').then(
    (m) => ({ default: m.CategoryBreakdown })
  )
)

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [view, setView] = useState<DashboardView>('list')
  const [isParsingScreenshots, setIsParsingScreenshots] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const { expenses, loading, deleteExpense, addExpense, updateExpense } = useExpenses(yearMonth)

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

  const handleImagesSelected = useCallback(async (files: File[]) => {
    setSelectedImages(files)
    setIsParsingScreenshots(true)

    // Create an abort controller for cancellation
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const items = await screenshotApi.parseScreenshots(files, abortController.signal)
      
      // Navigate to draft page with parsed items
      navigate({
        to: '/expense-draft',
        search: { items },
      })
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        // User cancelled - do nothing
        console.log('Screenshot parsing cancelled')
      } else {
        console.error('Failed to parse screenshots:', err)
        alert('Failed to parse screenshots. Please try again.')
      }
    } finally {
      setIsParsingScreenshots(false)
      setSelectedImages([])
      abortControllerRef.current = null
    }
  }, [navigate])

  const handleCancelParsing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return (
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
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500 border-t-pink-500" />
              </div>
            }
          >
            <CategoryBreakdown
              expenses={expenses}
              loading={loading}
              onDelete={deleteExpense}
              onExpenseClick={handleExpenseClick}
            />
          </Suspense>
        )}
      </SwipeContainer>

      {/* Loading overlay for screenshot parsing */}
      {isParsingScreenshots && (
        <ScreenshotLoadingOverlay
          onCancel={handleCancelParsing}
          imageCount={selectedImages.length}
        />
      )}

      {/* FAB - Add expense (with long press for image picker) */}
      <ImagePickerButton
        onImagesSelected={handleImagesSelected}
        onStandardClick={() => {
          setSelectedExpense(null)
          setIsModalOpen(true)
        }}
      />

      {/* Add/Edit Expense Modal */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddExpense}
        expense={selectedExpense}
        onUpdate={handleUpdateExpense}
      />

      <ViewTabs value={view} onChange={setView} />
    </>
  )
}
