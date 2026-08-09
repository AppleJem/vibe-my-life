import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useBudget, useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount, symbolFor } from '../../../utils/currency'

export const Route = createFileRoute('/_authenticated/settings/budget')({
  component: BudgetSettingsPage,
})

/** Matches the server's sanity bound in `metadata.controller.ts`. */
const MAX_BUDGET = 1_000_000_000

/** Days in the month "now" falls in — what the per-day figure below the field divides by. */
function daysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

function BudgetSettingsPage() {
  const navigate = useNavigate()
  const { monthlyBudget, loading, saveBudget } = useBudget()
  const { baseCurrency } = useCurrency()

  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed once the fetch lands — the context starts on 0 before metadata arrives, and an
  // unset budget stays an empty field rather than a literal "0" to delete.
  useEffect(() => {
    if (loading) return
    setDraft(monthlyBudget > 0 ? String(monthlyBudget) : '')
  }, [loading, monthlyBudget])

  const trimmed = draft.trim()
  // An empty field is a deliberate "no budget", not a typo — it clears the setting.
  // Thousands separators are stripped so a pasted "2,000" isn't rejected as NaN.
  const parsed = trimmed === '' ? 0 : Number(trimmed.replace(/,/g, ''))
  // The upper bound mirrors the server's, so an absurd figure fails here with a
  // usable message instead of coming back as a generic 400.
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_BUDGET
  const perDay = valid && parsed > 0 ? parsed / daysInCurrentMonth() : null

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveBudget(parsed)
      navigate({ to: '/settings' })
    } catch (err) {
      console.error(err)
      setSaveError('Failed to save budget')
      setSaving(false)
    }
  }

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate({ to: '/settings' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Monthly Budget</h2>
      </div>
      <p className="text-sm text-zinc-500 mb-6 pl-1">
        How much you plan to spend in a month. The dashboard shows a progress bar against
        it. Income doesn't count towards the budget — only money out.
      </p>

      <div className="bg-zinc-900 rounded-xl p-4">
        <label htmlFor="monthly-budget" className="block text-xs font-medium text-zinc-400 mb-2">
          Budget in {baseCurrency}
        </label>
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-rose-400">
          <span className="text-zinc-500">{symbolFor(baseCurrency)}</span>
          <input
            id="monthly-budget"
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="No budget"
            className="flex-1 min-w-0 bg-transparent text-zinc-100 outline-none"
          />
          {trimmed !== '' && (
            <button
              onClick={() => setDraft('')}
              className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              aria-label="Clear budget"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!valid ? (
          <p className="text-xs text-red-400 mt-2">
            Enter a positive amount, or leave it empty for no budget.
          </p>
        ) : perDay ? (
          <p className="text-xs text-zinc-500 mt-2">
            About {formatAmount(perDay, baseCurrency)} a day this month.
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-2">
            Leave this empty to hide the progress bar.
          </p>
        )}
      </div>

      {saveError && <p className="text-sm text-red-400 mt-3 text-center">{saveError}</p>}

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="w-full py-3 rounded-xl bg-pink-500 text-white font-semibold shadow-lg shadow-pink-500/25 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
