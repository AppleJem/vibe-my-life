import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCategories } from '../../../contexts/MetadataContext'
import { expenseKeys } from '../../../hooks/useExpenses'
import { TypeToggle } from '../../../components/TypeToggle'
import {
  formatCategory,
  validateCategoryName,
  type Category,
} from '../../../constants/categories'
import type { CategoryRename } from '../../../services/api'
import type { TransactionType } from '../../../types/expense'

export const Route = createFileRoute('/_authenticated/settings/categories')({
  component: ConfigureCategoriesPage,
})

interface DraftNode {
  id: string
  name: string
  /** Full path as originally loaded; absent for newly added nodes. */
  originalPath?: string
}

interface DraftCategory extends DraftNode {
  subcategories: DraftNode[]
}

/**
 * Draft-row keys only. `crypto.randomUUID` is unavailable in non-secure
 * contexts (e.g. the dev server over a LAN IP), so fall back to a counter.
 */
let idCounter = 0
const newId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `draft-${Date.now().toString(36)}-${idCounter++}`

function toDraft(categories: Category[]): DraftCategory[] {
  return categories.map((cat) => ({
    id: newId(),
    name: cat.name,
    originalPath: cat.name,
    subcategories: cat.subcategories.map((sub) => ({
      id: newId(),
      name: sub,
      originalPath: formatCategory(cat.name, sub),
    })),
  }))
}

const toCategories = (draft: DraftCategory[]): Category[] =>
  draft.map((c) => ({
    name: c.name.trim(),
    subcategories: c.subcategories.map((s) => s.name.trim()),
  }))

/**
 * Renames of nodes that already existed, so the backend can rewrite matching rows.
 * Removed nodes emit nothing — past entries keep their old category.
 */
function collectRenames(draft: DraftCategory[]): CategoryRename[] {
  const renames: CategoryRename[] = []
  for (const cat of draft) {
    const parentName = cat.name.trim()
    if (cat.originalPath && cat.originalPath !== parentName) {
      renames.push({ from: cat.originalPath, to: parentName })
    }
    for (const sub of cat.subcategories) {
      const path = formatCategory(parentName, sub.name.trim())
      if (sub.originalPath && sub.originalPath !== path) {
        renames.push({ from: sub.originalPath, to: path })
      }
    }
  }
  return renames
}

/** Returns errors keyed by node id, empty when the draft is valid. */
function validate(draft: DraftCategory[]): Record<string, string> {
  const found: Record<string, string> = {}
  const seenParents = new Set<string>()

  for (const cat of draft) {
    const err = validateCategoryName(cat.name)
    if (err) {
      found[cat.id] = err
    } else if (seenParents.has(cat.name.trim())) {
      found[cat.id] = 'Duplicate category name'
    } else {
      seenParents.add(cat.name.trim())
    }

    const seenSubs = new Set<string>()
    for (const sub of cat.subcategories) {
      const subErr = validateCategoryName(sub.name)
      if (subErr) {
        found[sub.id] = subErr
      } else if (seenSubs.has(sub.name.trim())) {
        found[sub.id] = 'Duplicate subcategory name'
      } else {
        seenSubs.add(sub.name.trim())
      }
    }
  }

  return found
}

function ConfigureCategoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { categories, incomeCategories, loading, saveCategories } = useCategories()

  const [tab, setTab] = useState<TransactionType>('expense')
  // The two lists are edited side by side and saved together, so both drafts stay
  // mounted — switching tabs must not discard unsaved edits to the other one.
  const [expenseDraft, setExpenseDraft] = useState<DraftCategory[]>(() => toDraft(categories))
  const [incomeDraft, setIncomeDraft] = useState<DraftCategory[]>(() => toDraft(incomeCategories))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed once the fetch lands (the context starts on the fallback defaults)
  useEffect(() => {
    if (loading) return
    setExpenseDraft(toDraft(categories))
    setIncomeDraft(toDraft(incomeCategories))
  }, [loading, categories, incomeCategories])

  const draft = tab === 'income' ? incomeDraft : expenseDraft
  const setDraft = tab === 'income' ? setIncomeDraft : setExpenseDraft

  const handleSave = async () => {
    const found = { ...validate(expenseDraft), ...validate(incomeDraft) }
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Errors on the hidden tab would otherwise look like a save that silently did
      // nothing — jump to whichever tab actually has them.
      const expenseHasErrors = Object.keys(validate(expenseDraft)).length > 0
      setTab(expenseHasErrors ? 'expense' : 'income')
      return
    }

    const renames = collectRenames(expenseDraft)
    const incomeRenames = collectRenames(incomeDraft)

    setSaving(true)
    setSaveError(null)
    try {
      await saveCategories({
        categories: toCategories(expenseDraft),
        renames,
        incomeCategories: toCategories(incomeDraft),
        incomeRenames,
      })
      // The backend rewrites renamed categories across every month, so any cached
      // list is now out of date. Deletions leave existing entries alone.
      if (renames.length > 0 || incomeRenames.length > 0) {
        await queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      }
      navigate({ to: '/settings' })
    } catch (err) {
      console.error(err)
      setSaveError('Failed to save categories')
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
        <h2 className="text-lg font-semibold text-zinc-100">Categories</h2>
      </div>
      <p className="text-sm text-zinc-500 mb-4 pl-1">
        Expense and income keep separate lists. Renaming updates all existing entries of
        that type. Deleting leaves them untouched.
      </p>

      <TypeToggle value={tab} onChange={setTab} className="mb-4" />

      <CategoryEditor draft={draft} setDraft={setDraft} errors={errors} kind={tab} />

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

interface CategoryEditorProps {
  draft: DraftCategory[]
  setDraft: React.Dispatch<React.SetStateAction<DraftCategory[]>>
  errors: Record<string, string>
  kind: TransactionType
}

/** The list editor for one type. Rendered once, against whichever tab is active. */
function CategoryEditor({ draft, setDraft, errors, kind }: CategoryEditorProps) {
  const updateCategory = (id: string, name: string) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  const updateSubcategory = (catId: string, subId: string, name: string) => {
    setDraft((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, name } : s)) }
          : c
      )
    )
  }

  const addCategory = () => {
    setDraft((prev) => [...prev, { id: newId(), name: '', subcategories: [] }])
  }

  const addSubcategory = (catId: string) => {
    setDraft((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: [...c.subcategories, { id: newId(), name: '' }] }
          : c
      )
    )
  }

  const removeCategory = (id: string) => {
    setDraft((prev) => prev.filter((c) => c.id !== id))
  }

  const removeSubcategory = (catId: string, subId: string) => {
    setDraft((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
          : c
      )
    )
  }

  const focusRing = kind === 'income' ? 'focus:ring-lime-400' : 'focus:ring-rose-400'
  const addHover = kind === 'income' ? 'hover:text-lime-400' : 'hover:text-rose-400'
  const addBorder =
    kind === 'income' ? 'hover:border-lime-400' : 'hover:border-rose-400'

  return (
    <>
      <div className="space-y-3">
        {draft.map((cat) => (
          <div key={cat.id} className="bg-zinc-900 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <input
                value={cat.name}
                onChange={(e) => updateCategory(cat.id, e.target.value)}
                placeholder="Category name (emoji welcome)"
                className={`flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 ${focusRing}`}
              />
              <button
                onClick={() => removeCategory(cat.id)}
                className="text-zinc-600 hover:text-red-400 transition-colors p-2"
                aria-label="Delete category"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            {errors[cat.id] && (
              <p className="text-xs text-red-400 mt-1 px-1">{errors[cat.id]}</p>
            )}

            <div className="mt-2 pl-4 space-y-2 border-l border-zinc-800 ml-1">
              {cat.subcategories.map((sub) => (
                <div key={sub.id}>
                  <div className="flex items-center gap-2">
                    <input
                      value={sub.name}
                      onChange={(e) => updateSubcategory(cat.id, sub.id, e.target.value)}
                      placeholder="Subcategory name"
                      className={`flex-1 bg-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 ${focusRing}`}
                    />
                    <button
                      onClick={() => removeSubcategory(cat.id, sub.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-2"
                      aria-label="Delete subcategory"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {errors[sub.id] && (
                    <p className="text-xs text-red-400 mt-1 px-1">{errors[sub.id]}</p>
                  )}
                </div>
              ))}

              <button
                onClick={() => addSubcategory(cat.id)}
                className={`text-xs text-zinc-500 ${addHover} transition-colors py-1`}
              >
                + Add subcategory
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addCategory}
        className={`w-full mt-4 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 ${addHover} ${addBorder} transition-colors`}
      >
        + Add category
      </button>
    </>
  )
}
