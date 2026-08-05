import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AddExpenseModal } from '../../components/ExpenseTracker/AddExpenseModal/AddExpenseModal'
import { expenseKeys } from '../../hooks/useExpenses'
import { displayCategory } from '../../constants/categories'
import { screenshotApi, type ParsedExpenseItem } from '../../services/api'
import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount, hasUsableRate } from '../../utils/currency'
import type { CreateExpenseInput, Expense } from '../../types/expense'

export const Route = createFileRoute('/_authenticated/expense-draft')({
  validateSearch: (search: Record<string, unknown>) => ({
    items: (search.items as ParsedExpenseItem[]) || [],
  }),
  component: ExpenseDraftPage,
})

function ExpenseDraftPage() {
  const { items } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { baseCurrency } = useCurrency()

  const [draftItems, setDraftItems] = useState<ParsedExpenseItem[]>(items)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Foreign items we couldn't find a rate for. Saving them would bank the foreign
  // figure as a base-currency amount, so the save waits until they're edited or dropped.
  const unpricedCount = draftItems.filter((item) => !hasUsableRate(item)).length

  const handleEditItem = useCallback((index: number) => {
    setEditingIndex(index)
  }, [])

  const handleUpdateItem = useCallback(
    async (input: CreateExpenseInput) => {
      if (editingIndex === null) return

      // Update the draft item (don't save to DB yet). The modal has already converted
      // to the base currency, so `amount` is base and the foreign fields describe what
      // was typed — the same shape the parsed items arrive in.
      setDraftItems((prev) => {
        const updated = [...prev]
        updated[editingIndex] = {
          date: input.date,
          amount: input.amount,
          type: input.type || 'expense',
          category: input.category,
          note: input.note || '',
          baseCurrency: input.baseCurrency ?? baseCurrency,
          ...(input.currency && {
            currency: input.currency,
            originalAmount: input.originalAmount,
            rate: input.rate,
          }),
        }
        return updated
      })
      setEditingIndex(null)
    },
    [editingIndex, baseCurrency]
  )

  const handleDeleteItem = useCallback((index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleConfirmAll = useCallback(async () => {
    if (draftItems.length === 0) return
    if (unpricedCount > 0) return

    setIsSaving(true)
    setError(null)

    try {
      // Convert draft items to CreateExpenseInput format. `amount` is already in the
      // base currency; the foreign trio only rides along when the item was foreign.
      const inputs: CreateExpenseInput[] = draftItems.map((item) => ({
        date: item.date,
        amount: item.amount,
        type: item.type,
        category: item.category,
        note: item.note,
        baseCurrency: item.baseCurrency ?? baseCurrency,
        ...(item.currency && {
          currency: item.currency,
          originalAmount: item.originalAmount,
          rate: item.rate,
        }),
      }))

      await screenshotApi.batchCreateExpenses(inputs)

      // Invalidate expense queries to refresh the list
      const months = new Set(draftItems.map((item) => item.date.slice(0, 7)))
      await Promise.all(
        [...months].map((month) =>
          queryClient.invalidateQueries({ queryKey: expenseKeys.month(month) })
        )
      )

      // Navigate back to home
      navigate({ to: '/' })
    } catch (err) {
      console.error('Failed to save expenses:', err)
      setError('Failed to save expenses. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [draftItems, navigate, queryClient, baseCurrency, unpricedCount])

  const handleCancel = useCallback(() => {
    navigate({ to: '/' })
  }, [navigate])

  // Prepare the expense for the modal in edit mode
  const editingExpense: Expense | null =
    editingIndex !== null && draftItems[editingIndex]
      ? {
          id: 'draft-edit',
          date: draftItems[editingIndex].date,
          amount: draftItems[editingIndex].amount,
          type: draftItems[editingIndex].type,
          category: draftItems[editingIndex].category,
          note: draftItems[editingIndex].note,
          createdAt: new Date().toISOString(),
          // Carried through so the modal opens on the right currency instead of
          // silently resetting a foreign item to the base.
          baseCurrency: draftItems[editingIndex].baseCurrency ?? baseCurrency,
          currency: draftItems[editingIndex].currency,
          originalAmount: draftItems[editingIndex].originalAmount,
          rate: draftItems[editingIndex].rate,
        }
      : null

  if (draftItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 -mt-6 -mb-28">
        <div className="text-6xl mb-4">📷</div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">No Items Found</h2>
        <p className="text-sm text-zinc-400 mb-6 text-center">
          No expense items were detected in the screenshot(s).
        </p>
        <button
          onClick={handleCancel}
          className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    // Cancels the Layout's page padding: this screen is its own edge-to-edge
    // surface with a bottom-anchored action bar, not a padded content block.
    <div className="flex flex-1 min-h-0 flex-col -mx-4 -mt-6 -mb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button
          onClick={handleCancel}
          className="text-sm text-zinc-400 hover:text-zinc-100"
        >
          Cancel
        </button>
        <span className="text-base font-semibold text-zinc-100">
          Review Expenses
        </span>
        <span className="text-sm text-zinc-500">{draftItems.length} items</span>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-zinc-800/50">
        <p className="text-xs text-zinc-400">
          Review the extracted expenses below. Tap on any item to edit it, or swipe left to delete.
        </p>
      </div>

      {/* Draft items list */}
      <div className="flex-1 overflow-y-auto">
        {draftItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
            onClick={() => handleEditItem(index)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-zinc-100">
                  {displayCategory(item.category)}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    item.type === 'income'
                      ? 'bg-lime-500/20 text-lime-400'
                      : 'bg-pink-500/20 text-pink-400'
                  }`}
                >
                  {item.type === 'income' ? 'Income' : 'Expense'}
                </span>
              </div>
              {item.note && (
                <p className="text-xs text-zinc-500 truncate">{item.note}</p>
              )}
              <p className="text-xs text-zinc-600 mt-1">{item.date}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span
                  className={`text-base font-semibold ${
                    item.type === 'income' ? 'text-lime-400' : 'text-zinc-100'
                  }`}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {hasUsableRate(item)
                    ? formatAmount(item.amount, item.baseCurrency ?? baseCurrency)
                    : formatAmount(item.originalAmount ?? item.amount, item.currency!)}
                </span>
                {/* What was actually spoken, kept visible so a bad conversion is obvious */}
                {item.currency && hasUsableRate(item) && (
                  <p className="text-xs text-zinc-500">
                    {formatAmount(item.originalAmount ?? item.amount, item.currency)}
                  </p>
                )}
                {item.currency && !hasUsableRate(item) && (
                  <p className="text-xs text-amber-400">no {item.currency} rate</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteItem(index)
                }}
                className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Unpriced foreign items block the save until they're edited or removed */}
      {unpricedCount > 0 && (
        <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20">
          <p className="text-sm text-amber-400">
            {unpricedCount === 1 ? '1 item has' : `${unpricedCount} items have`} no exchange
            rate. Tap to pick a currency, or delete to continue.
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Bottom actions */}
      <div className="border-t border-zinc-800 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleConfirmAll}
          disabled={isSaving || draftItems.length === 0 || unpricedCount > 0}
          className="w-full py-3 bg-pink-500 text-white rounded-lg font-semibold shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving
            ? 'Saving...'
            : `Save ${draftItems.length} Expense${draftItems.length > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Edit Modal */}
      <AddExpenseModal
        isOpen={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        onSubmit={handleUpdateItem}
        expense={editingExpense}
      />
    </div>
  )
}
