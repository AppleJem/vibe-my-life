import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  metadataModel,
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_BASE_CURRENCY,
} from './metadata.model.js'
import { expenseModel } from '../expense/expense.model.js'
import type { TransactionType } from '../expense/expense.types.d.js'
import type { CategoryRename } from './metadata.types.d.js'

const categoryName = z
  .string()
  .trim()
  .min(1, 'Category name cannot be empty')
  .refine((name) => !name.includes('#'), '# is reserved as the subcategory separator')

const hasNoDuplicates = (names: string[]) =>
  new Set(names).size === names.length

const categorySchema = z.object({
  name: categoryName,
  subcategories: z
    .array(categoryName)
    .default([])
    .refine(hasNoDuplicates, 'Subcategory names must be unique'),
})

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')

const saveCurrencySchema = z.object({
  baseCurrency: currencyCode,
  currencies: z
    .array(currencyCode)
    .default([])
    .refine(hasNoDuplicates, 'Currencies must be unique'),
})

// 0 clears the budget. The cap is a sanity bound, not a product limit — it exists so a
// fat-fingered paste can't be stored as a budget nothing will ever exceed.
const saveBudgetSchema = z.object({
  monthlyBudget: z
    .number()
    .finite()
    .min(0, 'Budget cannot be negative')
    .max(1_000_000_000, 'Budget is unrealistically large'),
})

const categoryList = z
  .array(categorySchema)
  .refine((cats) => hasNoDuplicates(cats.map((c) => c.name)), 'Category names must be unique')

const renameList = z
  .array(z.object({ from: z.string().min(1), to: z.string().min(1) }))
  .optional()
  .default([])

// Both lists are optional so a client saving only one can't clobber the other.
const saveCategoriesSchema = z.object({
  categories: categoryList.optional(),
  renames: renameList,
  incomeCategories: categoryList.optional(),
  incomeRenames: renameList,
})

/**
 * Applies renames to existing rows of one type. Most specific first, so
 * "Food#Drinks" is rewritten before "Food" sweeps up whatever is left under the old
 * parent name. Returns how many rows were touched.
 */
async function applyRenames(
  userId: string,
  renames: CategoryRename[],
  type: TransactionType
): Promise<number> {
  const ordered = [...renames].sort((a, b) => {
    const depth = b.from.split('#').length - a.from.split('#').length
    return depth !== 0 ? depth : b.from.length - a.from.length
  })

  let updated = 0
  for (const { from, to } of ordered) {
    if (from === to) continue
    updated += await expenseModel.renameCategory(userId, from, to, type)
  }
  return updated
}

export const metadataController = {
  async getMetadata(req: Request, res: Response) {
    try {
      const existing = await metadataModel.get(req.userId!)

      if (existing) {
        return res.json({ metadata: existing })
      }

      // First load for this user: seed the defaults so the shape is always present
      const metadata = await metadataModel.patch(req.userId!, {
        categories: DEFAULT_CATEGORIES,
        incomeCategories: DEFAULT_INCOME_CATEGORIES,
        baseCurrency: DEFAULT_BASE_CURRENCY,
        currencies: [],
      })
      return res.json({ metadata })
    } catch (err) {
      console.error('Error fetching metadata:', err)
      return res.status(500).json({ error: 'Failed to fetch metadata' })
    }
  },

  async saveCategories(req: Request, res: Response) {
    const parsed = saveCategoriesSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const { categories, renames, incomeCategories, incomeRenames } = parsed.data

    try {
      const updatedCount =
        (await applyRenames(req.userId!, renames, 'expense')) +
        (await applyRenames(req.userId!, incomeRenames, 'income'))

      const metadata = await metadataModel.patch(req.userId!, {
        ...(categories && { categories }),
        ...(incomeCategories && { incomeCategories }),
      })
      return res.json({ metadata, updatedCount })
    } catch (err) {
      console.error('Error saving categories:', err)
      return res.status(500).json({ error: 'Failed to save categories' })
    }
  },

  async saveCurrency(req: Request, res: Response) {
    const parsed = saveCurrencySchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const { baseCurrency } = parsed.data
    // The base is implicit in the list the client renders, so never store it twice.
    const currencies = parsed.data.currencies.filter((code) => code !== baseCurrency)

    try {
      const metadata = await metadataModel.patch(req.userId!, { baseCurrency, currencies })
      return res.json({ metadata })
    } catch (err) {
      console.error('Error saving currency settings:', err)
      return res.status(500).json({ error: 'Failed to save currency settings' })
    }
  },

  async saveBudget(req: Request, res: Response) {
    const parsed = saveBudgetSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const metadata = await metadataModel.patch(req.userId!, {
        monthlyBudget: parsed.data.monthlyBudget,
      })
      return res.json({ metadata })
    } catch (err) {
      console.error('Error saving budget:', err)
      return res.status(500).json({ error: 'Failed to save budget' })
    }
  },
}
