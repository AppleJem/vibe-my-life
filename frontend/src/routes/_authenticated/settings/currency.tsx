import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useCurrency } from '../../../contexts/MetadataContext'
import { CURRENCY_META, metaFor } from '../../../constants/currencies'
import { formatRate } from '../../../utils/currency'

export const Route = createFileRoute('/_authenticated/settings/currency')({
  component: CurrencySettingsPage,
})

function relativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function CurrencySettingsPage() {
  const navigate = useNavigate()
  const {
    baseCurrency,
    currencies,
    rates,
    ratesFetchedAt,
    ratesError,
    loading,
    saveCurrency,
  } = useCurrency()

  const [draftBase, setDraftBase] = useState(baseCurrency)
  const [draftExtras, setDraftExtras] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed once the fetch lands (the context starts on the fallback defaults)
  useEffect(() => {
    if (loading) return
    setDraftBase(baseCurrency)
    setDraftExtras(currencies.filter((c) => c !== baseCurrency))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, baseCurrency, currencies.join(',')])

  // Everything the rates API knows about, plus the curated codes so the list is
  // usable before the first successful fetch.
  const selectable = useMemo(() => {
    const codes = new Set([...Object.keys(CURRENCY_META), ...Object.keys(rates)])
    return [...codes].sort()
  }, [rates])

  const available = selectable.filter((c) => c !== draftBase && !draftExtras.includes(c))
  const baseChanged = !loading && draftBase !== baseCurrency

  const addCurrency = (code: string) => {
    setDraftExtras((prev) => (prev.includes(code) ? prev : [...prev, code]))
    setAdding(false)
  }

  const removeCurrency = (code: string) => {
    setDraftExtras((prev) => prev.filter((c) => c !== code))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveCurrency(draftBase, draftExtras)
      navigate({ to: '/settings' })
    } catch (err) {
      console.error(err)
      setSaveError('Failed to save currency settings')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
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
        <h2 className="text-lg font-semibold text-zinc-100">Currency</h2>
      </div>
      <p className="text-sm text-zinc-500 mb-6 pl-1">
        Every expense is recorded in your base currency. Add the currencies you spend in
        while travelling.
      </p>

      {/* Base currency */}
      <div className="bg-zinc-900 rounded-xl p-4 mb-4">
        <label htmlFor="base-currency" className="block text-xs font-medium text-zinc-400 mb-2">
          Base currency
        </label>
        <select
          id="base-currency"
          value={draftBase}
          onChange={(e) => setDraftBase(e.target.value)}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 outline-none focus:ring-2 focus:ring-rose-400"
        >
          {selectable.map((code) => (
            <option key={code} value={code}>
              {code} — {metaFor(code).name}
            </option>
          ))}
        </select>

        {baseChanged && (
          <p className="text-xs text-amber-400 mt-2">
            Existing expenses stay recorded in {baseCurrency} and will not be converted.
          </p>
        )}
      </div>

      {/* Additional currencies */}
      <p className="text-xs font-medium text-zinc-400 mb-2 pl-1">Additional currencies</p>

      {draftExtras.length === 0 && !adding && (
        <p className="text-sm text-zinc-600 mb-2 pl-1">None yet.</p>
      )}

      <div className="space-y-2">
        {draftExtras.map((code) => {
          const rate = rates[code]
          return (
            <div
              key={code}
              className="bg-zinc-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-zinc-100 font-medium">
                  {code} <span className="text-zinc-500 font-normal">{metaFor(code).symbol}</span>
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {rate ? formatRate(draftBase, code, rate) : 'Rate unavailable'}
                </p>
              </div>
              <button
                onClick={() => removeCurrency(code)}
                className="text-zinc-600 hover:text-red-400 transition-colors p-2 shrink-0"
                aria-label={`Remove ${code}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {adding ? (
        <select
          autoFocus
          defaultValue=""
          onChange={(e) => e.target.value && addCurrency(e.target.value)}
          onBlur={() => setAdding(false)}
          className="w-full mt-3 bg-zinc-800 rounded-xl px-3 py-3 text-zinc-100 outline-none focus:ring-2 focus:ring-rose-400"
        >
          <option value="" disabled>
            Select a currency…
          </option>
          {available.map((code) => (
            <option key={code} value={code}>
              {code} — {metaFor(code).name}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full mt-3 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-rose-400 hover:border-rose-400 transition-colors"
        >
          + Add currency
        </button>
      )}

      {ratesError && <p className="text-xs text-amber-400 mt-3 pl-1">{ratesError}</p>}

      <p className="text-xs text-zinc-600 mt-6 pl-1">
        Rates by exchangerate-api.com
        {ratesFetchedAt && ` · updated ${relativeTime(ratesFetchedAt)}`}
      </p>

      {saveError && <p className="text-sm text-red-400 mt-3 text-center">{saveError}</p>}

      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleSave}
            disabled={saving}
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
