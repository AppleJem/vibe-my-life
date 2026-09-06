import { useState } from 'react'
import { Calculator } from '../AddExpenseModal/Calculator'
import { TextAreaInput } from '../AddExpenseModal/TextAreaInput'
import { TagPicker } from './TagPicker'
import { ConfirmDialog } from '../../ConfirmDialog'
import { INPUT } from '../../Habits/fieldStyles'
import { useCurrency } from '../../../contexts/MetadataContext'
import { formatAmount, formatRate, toBase } from '../../../utils/currency'
import type { CreateHoldingInput, Holding, UpdateHoldingInput } from '../../../types/holding'

interface HoldingEditorProps {
  /** null = creating. */
  holding: Holding | null
  /** Tags already in use, for the picker's chips. */
  tags: string[]
  onClose: () => void
  onCreate: (input: CreateHoldingInput) => Promise<unknown>
  onUpdate: (args: { id: string; updates: UpdateHoldingInput }) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

/**
 * The whole holding on one scrolling page, like the recurring-rule editor and for the
 * same reason: revising a balance is a deliberate, occasional act, and seeing every field
 * at once is what makes "what am I actually changing?" answerable.
 *
 * The currency here is the currency the money is *held* in, and it is stored as-is. There
 * is no rate to capture — the planning view converts at read time — so unlike the expense
 * form, nothing about today's rate is baked into what gets saved.
 */
export function HoldingEditor({
  holding,
  tags,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: HoldingEditorProps) {
  const { baseCurrency, currencies, rates } = useCurrency()

  const [name, setName] = useState(holding?.name ?? '')
  const [amount, setAmount] = useState(holding?.amount ?? 0)
  const [currency, setCurrency] = useState(holding?.currency ?? baseCurrency)
  const [tag, setTag] = useState(holding?.tag ?? '')
  const [notes, setNotes] = useState(holding?.notes ?? '')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForeign = currency !== baseCurrency
  const rate = rates[currency]
  const canConvert = typeof rate === 'number' && rate > 0

  const canSave = name.trim().length > 0 && amount >= 0

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to save. Please try again.')
      setIsBusy(false)
    }
  }

  const handleSave = () => {
    if (!canSave) return
    const input = { name: name.trim(), amount, currency, tag, notes }

    void run(() =>
      holding ? onUpdate({ id: holding.id, updates: input }) : onCreate(input)
    )
  }

  return (
    // A full-screen layer, like `AddExpenseModal`, rather than a page inside the
    // dashboard: the planning tab keeps the bottom tab bar on screen, and a save bar
    // pinned to `bottom-0` would sit underneath it. Covering the tab bar also means an
    // edit in progress can't be lost to a stray tab tap — the back arrow is the way out.
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="shrink-0 border-b border-zinc-800">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-3">
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
            aria-label="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-zinc-100">
            {holding ? 'Edit holding' : 'New holding'}
          </h2>
        </div>
      </div>

      {/* Scrolls on its own so the header and save bar stay put. `max-w-lg` matches the
          page width `Layout` gives every other screen. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
          <Section label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emergency fund"
              className={INPUT}
            />
          </Section>

          <Section
            label="Balance"
            hint={
              isForeign
                ? canConvert
                  ? `Held in ${currency} and stored that way. Worth about ${formatAmount(
                      toBase(amount, rate, baseCurrency),
                      baseCurrency
                    )} today · ${formatRate(baseCurrency, currency, rate)}. The chart re-converts at the current rate every time you open it.`
                  : `Held in ${currency}. No exchange rate is available right now, so this holding won't be counted in the chart until one is.`
                : undefined
            }
          >
            {currencies.length > 1 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {currencies.map((code) => (
                  <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      code === currency
                        ? 'bg-pink-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
            <Calculator value={amount} onChange={setAmount} currency={currency} />
          </Section>

          <Section label="Tag" hint="Holdings sharing a tag can be grouped into one slice.">
            <TagPicker value={tag} tags={tags} onChange={setTag} />
          </Section>

          <Section label="Notes">
            <TextAreaInput
              value={notes}
              onChange={setNotes}
              label="Notes (optional)"
              placeholder="Started Jan 2024 · 3.4% p.a. · matures 15 Mar 2026 · why this exists…"
              rows={6}
              autoFocus={false}
            />
          </Section>

          {holding && (
            <button
              onClick={() => setDeleteOpen(true)}
              disabled={isBusy}
              className="w-full rounded-xl bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              Delete holding
            </button>
          )}
        </div>
      </div>

      {/* The last row of the flex column, not a fixed bar — the layer already owns the
          full screen, so it lands on the bottom edge without stacking on anything. */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg">
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!canSave || isBusy}
            className="w-full rounded-lg bg-pink-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-shadow hover:shadow-pink-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? 'Saving…' : holding ? 'Save changes' : 'Add holding'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete this holding?"
        message="It disappears from the chart and its notes go with it. Nothing else is affected."
        confirmLabel="Delete"
        confirmingLabel="Deleting…"
        isConfirming={isBusy}
        tone="danger"
        onConfirm={() => void run(() => onDelete(holding!.id))}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

function Section({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {children}
      {hint && <p className="mt-2 px-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}
