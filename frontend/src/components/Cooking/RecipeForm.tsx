import { useState } from 'react'
import { ConfirmDialog } from '../ConfirmDialog'
import { SortableList } from '../Habits/SortableList'
import { INPUT, RECIPE_EMOJIS } from './fieldStyles'
import { ServingsStepper } from './ServingsStepper'
import {
  UNIT_OPTIONS,
  formatDuration,
  formatStoredQuantity,
  unitOptionLabel,
} from '../../utils/units'
import type { Quantity, Recipe, RecipeDraft, RecipeInput } from '../../types/recipe'

/**
 * The recipe editor, used for all three ways a recipe gets written: reviewing what the parser
 * read out of a photo, typing one from scratch, and editing one already saved. The review
 * screen is not a separate thing — a parsed recipe is a draft that arrived pre-filled, and
 * being able to fix it here is the entire point of reviewing it.
 *
 * The whole recipe is a local draft committed by one save, which is what makes reordering
 * free: the server takes the arrays as the order, so a drag is a state update rather than a
 * write per row.
 */

interface DraftIngredient {
  id: string
  name: string
  quantity?: Quantity
  note?: string
}

interface DraftStep {
  id: string
  title: string
  description?: string
  durationSeconds?: number
  quantities?: Quantity[]
}

interface RecipeFormProps {
  /** A parsed draft, a stored recipe being edited, or null for a blank one. */
  initial: Recipe | RecipeDraft | null
  heading: string
  /** A line under the heading — what this particular visit to the form is for. */
  blurb?: string
  saveLabel: string
  isSaving: boolean
  onSave: (input: RecipeInput) => Promise<unknown>
  onClose: () => void
  /**
   * Absent while a recipe is being created: there is nothing stored to delete until the
   * first save, and a button that discarded an unsaved draft under the word "delete" would
   * be a different action wearing the same label. `onClose` is that action.
   */
  onDelete?: () => void
  isDeleting?: boolean
}

/**
 * `crypto.randomUUID` needs a secure context, which every deployment of this app is. The
 * fallback keeps a plain-http dev host from handing out `undefined` as a React key.
 */
const newId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Ids are local to the draft: a parsed row has never had one, a stored row keeps its own. */
const withIds = <T extends { id?: string }>(rows: T[]): (T & { id: string })[] =>
  rows.map((row) => ({ ...row, id: row.id ?? newId() }))

export function RecipeForm({
  initial,
  heading,
  blurb,
  saveLabel,
  isSaving,
  onSave,
  onClose,
  onDelete,
  isDeleting
}: RecipeFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? RECIPE_EMOJIS[0])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [servings, setServings] = useState(initial?.servings ?? 2)
  const [ingredients, setIngredients] = useState<DraftIngredient[]>(() =>
    withIds((initial?.ingredients ?? []) as DraftIngredient[])
  )
  const [steps, setSteps] = useState<DraftStep[]>(() =>
    withIds((initial?.steps ?? []) as DraftStep[])
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  /** The row open in a sheet — an existing one, or a blank one being added. */
  const [editingIngredient, setEditingIngredient] = useState<DraftIngredient | null>(null)
  const [editingStep, setEditingStep] = useState<DraftStep | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)

  // A recipe with a name but nothing in it is a note, not a recipe.
  const canSave =
    title.trim().length > 0 && (ingredients.length > 0 || steps.length > 0) && !isSaving

  const upsertIngredient = (row: DraftIngredient) => {
    setIngredients((current) =>
      current.some((candidate) => candidate.id === row.id)
        ? current.map((candidate) => (candidate.id === row.id ? row : candidate))
        : [...current, row]
    )
    setEditingIngredient(null)
  }

  const upsertStep = (row: DraftStep) => {
    setSteps((current) =>
      current.some((candidate) => candidate.id === row.id)
        ? current.map((candidate) => (candidate.id === row.id ? row : candidate))
        : [...current, row]
    )
    setEditingStep(null)
  }

  const handleSave = async () => {
    await onSave({
      title: title.trim(),
      emoji,
      ...(description.trim() && { description: description.trim() }),
      servings,
      // Ids go up as-is so a row keeps its identity across the save; one the form just added
      // carries a local id the server is happy to adopt.
      ingredients: ingredients.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        ...(row.quantity && { quantity: row.quantity }),
        ...(row.note?.trim() && { note: row.note.trim() }),
      })),
      steps: steps.map((row) => ({
        id: row.id,
        title: row.title.trim(),
        ...(row.description?.trim() && { description: row.description.trim() }),
        ...(row.durationSeconds !== undefined && { durationSeconds: row.durationSeconds }),
        ...(row.quantities?.length && { quantities: row.quantities }),
      })),
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setConfirmDiscard(true)}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">{heading}</h2>
      </div>

      {blurb && <p className="text-xs text-zinc-600 mb-6 pl-8">{blurb}</p>}

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowEmojis((current) => !current)}
          aria-label="Choose an emoji"
          className="shrink-0 w-12 h-11 rounded-lg bg-zinc-800 border border-zinc-700 text-2xl"
        >
          {emoji}
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recipe name"
          className={INPUT}
        />
      </div>

      {showEmojis && (
        <div className="grid grid-cols-8 gap-1 mb-3 rounded-xl bg-zinc-900 border border-zinc-800 p-2">
          {RECIPE_EMOJIS.map((candidate) => (
            <button
              key={candidate}
              onClick={() => {
                setEmoji(candidate)
                setShowEmojis(false)
              }}
              className={`h-9 rounded-lg text-xl ${candidate === emoji ? 'bg-amber-400/20' : 'hover:bg-zinc-800'
                }`}
            >
              {candidate}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="A line about it (optional)"
        rows={2}
        className={`${INPUT} resize-none mb-5`}
      />

      {/* The recipe's own yield. Editing it here changes what every stored amount *means*,
          which is why the reader's stepper never touches it. */}
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-3 mb-2">
        <ServingsStepper value={servings} base={servings} onChange={setServings} />
      </div>
      <p className="text-xs text-zinc-600 mb-6">
        What the amounts below are written for. Readers scale from here.
      </p>

      <Section
        label="Ingredients"
        count={ingredients.length}
        addLabel="+ Add ingredient"
        onAdd={() => setEditingIngredient({ id: newId(), name: '' })}
        empty="Nothing yet — an amount, a unit, and what it is."
      >
        <SortableList items={ingredients} keyOf={(row) => row.id} onReorder={setIngredients}>
          {(row) => (
            <Row
              onOpen={() => setEditingIngredient(row)}
              onRemove={() =>
                setIngredients((current) => current.filter((candidate) => candidate.id !== row.id))
              }
              removeLabel={`Delete ${row.name}`}
              primary={row.name || 'Unnamed'}
              secondary={
                <>
                  {row.quantity && (
                    <span className="text-amber-400">{formatStoredQuantity(row.quantity)}</span>
                  )}
                  {row.quantity && row.note && ' · '}
                  {row.note}
                  {!row.quantity && !row.note && 'No amount'}
                </>
              }
            />
          )}
        </SortableList>
      </Section>

      <Section
        label="Steps"
        count={steps.length}
        addLabel="+ Add step"
        onAdd={() => setEditingStep({ id: newId(), title: '' })}
        empty="Nothing yet — each step can carry a timer."
      >
        <SortableList items={steps} keyOf={(row) => row.id} onReorder={setSteps}>
          {(row) => (
            <Row
              onOpen={() => setEditingStep(row)}
              onRemove={() =>
                setSteps((current) => current.filter((candidate) => candidate.id !== row.id))
              }
              removeLabel={`Delete ${row.title}`}
              primary={row.title || 'Untitled step'}
              secondary={
                <>
                  {row.durationSeconds !== undefined && (
                    <span className="text-amber-400">{formatDuration(row.durationSeconds)}</span>
                  )}
                  {row.durationSeconds !== undefined && row.description && ' · '}
                  {row.description}
                  {row.durationSeconds === undefined && !row.description && 'No timer'}
                </>
              }
            />
          )}
        </SortableList>
      </Section>

      {/* Only on a stored recipe. Above the spacer, not below it — the spacer is what keeps
          the fixed save bar off the last thing on the page, and anything after it is under
          the bar. */}
      {onDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-10 w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 text-sm font-medium text-red-400 hover:bg-zinc-800"
        >
          Delete recipe
        </button>
      )}

      {/* Clears the fixed save bar, which would otherwise sit on top of the last row. */}
      <div className="h-24" />

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>

      {editingIngredient && (
        <IngredientSheet
          ingredient={editingIngredient}
          onConfirm={upsertIngredient}
          onCancel={() => setEditingIngredient(null)}
        />
      )}

      {editingStep && (
        <StepSheet
          step={editingStep}
          onConfirm={upsertStep}
          onCancel={() => setEditingStep(null)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Leave without saving?"
        message="Nothing here has been saved yet."
        confirmLabel="Leave"
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />

      {onDelete && (
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Delete this recipe?"
          message="The ingredients and steps go with it. There is no undo."
          isConfirming={isDeleting}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

interface SectionProps {
  label: string
  count: number
  addLabel: string
  empty: string
  onAdd: () => void
  children: React.ReactNode
}

function Section({ label, count, addLabel, empty, onAdd, children }: SectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">{label}</h3>
        <span className="text-xs text-zinc-600">{count}</span>
        {count > 1 && (
          <span className="ml-auto text-xs text-zinc-600">Drag the handles to reorder</span>
        )}
      </div>

      {count === 0 ? <p className="text-sm text-zinc-600 mb-3">{empty}</p> : children}

      <button
        onClick={onAdd}
        className="w-full rounded-xl bg-zinc-900 border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 mt-3"
      >
        {addLabel}
      </button>
    </div>
  )
}

interface RowProps {
  primary: string
  secondary: React.ReactNode
  removeLabel: string
  onOpen: () => void
  onRemove: () => void
}

/** One draggable row: tap the body to edit it, the bin to remove it. */
function Row({ primary, secondary, removeLabel, onOpen, onRemove }: RowProps) {
  return (
    <div className="flex items-center gap-3 h-full bg-zinc-900 rounded-xl pl-4 pr-1">
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 text-left h-full flex flex-col justify-center"
      >
        <p className="text-zinc-100 truncate">{primary}</p>
        <p className="text-xs text-zinc-500 truncate">{secondary}</p>
      </button>

      <button
        onClick={onRemove}
        aria-label={removeLabel}
        className="shrink-0 px-3 h-full text-zinc-600 hover:text-red-400 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

/** The sheet chrome both editors open in — the idiom the habit step sheet established. */
function Sheet({
  label,
  children,
  onCancel,
}: {
  label: string
  children: React.ReactNode
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto rounded-t-2xl bg-zinc-900 border-t border-zinc-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-zinc-400 mb-4">{label}</p>
        {children}
      </div>
    </div>
  )
}

function SheetButtons({
  onCancel,
  onConfirm,
  canConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
  canConfirm: boolean
}) {
  return (
    <div className="flex gap-3 mt-5">
      <button
        onClick={onCancel}
        className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={!canConfirm}
        className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
      >
        Done
      </button>
    </div>
  )
}

/** Digits and a single decimal point — an amount is a number. */
const numeric = (value: string): string =>
  value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')

interface AmountFieldsProps {
  amount: string
  unit: string | undefined
  onAmount: (amount: string) => void
  onUnit: (unit: string | undefined) => void
}

/**
 * An amount and its unit. The unit is a picker rather than free text, because a unit the
 * conversion table doesn't recognise is one that silently won't convert — and a recipe whose
 * amounts half convert is worse than one that doesn't.
 *
 * A unit that came in from a parse and isn't in the table is still offered, as itself, so
 * editing the row next to it doesn't quietly discard it.
 */
function AmountFields({ amount, unit, onAmount, onUnit }: AmountFieldsProps) {
  const known = UNIT_OPTIONS.some((group) => group.units.includes(unit))

  return (
    <div className="flex gap-2">
      <input
        value={amount}
        onChange={(e) => onAmount(numeric(e.target.value))}
        onFocus={(e) => e.target.select()}
        inputMode="decimal"
        placeholder="Amount"
        aria-label="Amount"
        className={`${INPUT} w-28`}
      />
      <select
        value={unit ?? ''}
        onChange={(e) => onUnit(e.target.value || undefined)}
        aria-label="Unit"
        className={INPUT}
      >
        {!known && unit && <option value={unit}>{unit}</option>}
        {UNIT_OPTIONS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.units.map((candidate) => (
              <option key={candidate ?? 'none'} value={candidate ?? ''}>
                {unitOptionLabel(candidate)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

/** A blank amount is "to taste" — the field is left empty rather than set to zero. */
const toQuantity = (amount: string, unit: string | undefined): Quantity | undefined => {
  const value = Number(amount)
  if (!amount.trim() || !Number.isFinite(value) || value <= 0) return undefined
  return { amount: value, ...(unit && { unit }) }
}

interface IngredientSheetProps {
  ingredient: DraftIngredient
  onConfirm: (ingredient: DraftIngredient) => void
  onCancel: () => void
}

function IngredientSheet({ ingredient, onConfirm, onCancel }: IngredientSheetProps) {
  const [name, setName] = useState(ingredient.name)
  const [amount, setAmount] = useState(
    ingredient.quantity ? String(ingredient.quantity.amount) : ''
  )
  const [unit, setUnit] = useState(ingredient.quantity?.unit)
  const [note, setNote] = useState(ingredient.note ?? '')

  const quantity = toQuantity(amount, unit)

  return (
    <Sheet label="Ingredient" onCancel={onCancel}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="All-purpose flour"
        autoFocus
        className={`${INPUT} mb-3`}
      />

      <AmountFields amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} />

      <p className="text-xs text-zinc-600 mt-2 mb-3">
        Leave the amount empty for anything measured to taste.
      </p>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Finely diced (optional)"
        className={INPUT}
      />

      <SheetButtons
        onCancel={onCancel}
        canConfirm={name.trim().length > 0}
        onConfirm={() =>
          onConfirm({
            id: ingredient.id,
            name: name.trim(),
            ...(quantity && { quantity }),
            ...(note.trim() && { note: note.trim() }),
          })
        }
      />
    </Sheet>
  )
}

/**
 * Drops one of a step's amounts and repairs the text around it: its marker goes, and every
 * marker above it shifts down to match its new index. Without the shift, deleting the first
 * of three amounts would silently re-point the other two at the wrong numbers.
 */
function dropQuantity(step: DraftStep, index: number): DraftStep {
  const reindex = (text: string): string =>
    text
      .replace(/\{(\d+)\}/g, (match, digits: string) => {
        const position = Number(digits)
        if (position === index) return ''
        return position > index ? `{${position - 1}}` : match
      })
      // A removed marker leaves a doubled space, or a space before the punctuation that
      // followed it.
      .replace(/ {2,}/g, ' ')
      .replace(/ ([,.;:])/g, '$1')
      .trim()

  return {
    ...step,
    title: reindex(step.title),
    ...(step.description !== undefined && { description: reindex(step.description) }),
    quantities: step.quantities?.filter((_, position) => position !== index),
  }
}

interface StepSheetProps {
  step: DraftStep
  onConfirm: (step: DraftStep) => void
  onCancel: () => void
}

/**
 * One step. Shaped after the habit action-item sheet — title, optional description, optional
 * timer — with one addition: the amounts the step's own text refers to.
 *
 * Those are edited as numbers rather than as words, because that is what lets them scale with
 * the servings and follow the unit toggle. The text carries a `{0}`-style marker where each
 * one belongs, and the marker is visible here on purpose: it is the only honest way to show
 * that the number in the sentence is a reference rather than a character.
 */
function StepSheet({ step, onConfirm, onCancel }: StepSheetProps) {
  const [draft, setDraft] = useState(step)
  const [timed, setTimed] = useState(step.durationSeconds !== undefined)
  const [minutes, setMinutes] = useState(String(Math.floor((step.durationSeconds ?? 0) / 60)))
  const [seconds, setSeconds] = useState(String((step.durationSeconds ?? 0) % 60))

  const durationSeconds = (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
  // A timed step with no time on it would ring the moment it started.
  const canConfirm = draft.title.trim().length > 0 && (!timed || durationSeconds > 0)

  const digits = (value: string, max: number) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3)
    return cleaned === '' ? '' : String(Math.min(Number(cleaned), max))
  }

  const quantities = draft.quantities ?? []

  const setQuantity = (index: number, quantity: Quantity) =>
    setDraft((current) => ({
      ...current,
      quantities: (current.quantities ?? []).map((candidate, position) =>
        position === index ? quantity : candidate
      ),
    }))

  /** A new amount is appended, its marker parked at the end of the text to be moved into place. */
  const addQuantity = () =>
    setDraft((current) => {
      const next = [...(current.quantities ?? []), { amount: 1 }]
      const marker = `{${next.length - 1}}`
      return {
        ...current,
        quantities: next,
        description: `${current.description ?? ''}${current.description ? ' ' : ''}${marker}`,
      }
    })

  return (
    <Sheet label="Step" onCancel={onCancel}>
      <input
        value={draft.title}
        onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
        placeholder="Sear the beef"
        autoFocus
        className={`${INPUT} mb-3`}
      />

      <textarea
        value={draft.description ?? ''}
        onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
        placeholder="The detail (optional)"
        rows={3}
        className={`${INPUT} resize-none mb-4`}
      />

      <button
        onClick={() => setTimed((current) => !current)}
        className={`w-full rounded-xl py-2.5 text-sm font-medium transition-colors mb-3 ${timed ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
      >
        {timed ? 'Timed step' : 'Add a timer'}
      </button>

      {timed && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <input
            value={minutes}
            onChange={(e) => setMinutes(digits(e.target.value, 999))}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            aria-label="Minutes"
            className={`${INPUT} w-20 text-center text-2xl font-bold`}
          />
          <span className="text-2xl font-bold text-zinc-500">:</span>
          <input
            value={seconds}
            onChange={(e) => setSeconds(digits(e.target.value, 59))}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            aria-label="Seconds"
            className={`${INPUT} w-20 text-center text-2xl font-bold`}
          />
          <span className="text-xs text-zinc-500 ml-1">min : sec</span>
        </div>
      )}

      <p className="text-sm text-zinc-400 mt-5 mb-1">Amounts in this step</p>
      <p className="text-xs text-zinc-600 mb-3">
        Kept as numbers so they scale with the servings and follow the unit toggle. Put a
        marker — <span className="text-zinc-400">{'{0}'}</span>,{' '}
        <span className="text-zinc-400">{'{1}'}</span> — in the text above wherever the amount
        belongs.
      </p>

      {quantities.map((quantity, index) => (
        <div key={index} className="flex items-center gap-2 mb-2">
          <span className="w-8 shrink-0 text-xs font-semibold text-amber-400">{`{${index}}`}</span>
          <div className="flex-1 min-w-0">
            <AmountFields
              amount={String(quantity.amount)}
              unit={quantity.unit}
              onAmount={(amount) =>
                setQuantity(index, { ...quantity, amount: Number(amount) || 0 })
              }
              onUnit={(unit) =>
                setQuantity(index, { amount: quantity.amount, ...(unit && { unit }) })
              }
            />
          </div>
          <button
            onClick={() => setDraft((current) => dropQuantity(current, index))}
            aria-label={`Remove amount ${index}`}
            className="shrink-0 px-2 text-zinc-600 hover:text-red-400 transition-colors"
          >
            &times;
          </button>
        </div>
      ))}

      <button
        onClick={addQuantity}
        className="w-full rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
      >
        + Add an amount
      </button>

      <SheetButtons
        onCancel={onCancel}
        canConfirm={canConfirm}
        onConfirm={() =>
          onConfirm({
            id: draft.id,
            title: draft.title.trim(),
            ...(draft.description?.trim() && { description: draft.description.trim() }),
            ...(timed && { durationSeconds }),
            // Zero-amount rows are placeholders a parse left behind: they render as their own
            // marker text and are not worth storing.
            ...(quantities.some((quantity) => quantity.amount > 0) && { quantities }),
          })
        }
      />
    </Sheet>
  )
}
