import type { Request, Response } from 'express'
import { z } from 'zod'
import { expenseModel } from './expense.model.js'
import type { CreateExpenseInput } from './expense.types.d.js'

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')

const transactionType = z.enum(['expense', 'income'])

// `amount` stays positive for both types — the sign is derived from `type` at render
// time, so income and expense are stored identically apart from the discriminator.
const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  amount: z.number().positive('Amount must be positive'),
  type: transactionType.optional().default('expense'),
  category: z.string().min(1, 'Category is required'),
  note: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  baseCurrency: currencyCode.optional(),
  currency: currencyCode.optional(),
  originalAmount: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  // Rows generated from a recurring rule; the client never sends these on the plain
  // create path, but the recurring module reuses this shape.
  recurringId: z.string().min(1).optional(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// null is accepted on the three foreign fields so the client can clear them when an
// expense is edited back to the base currency.
const updateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().optional(),
  type: transactionType.optional(),
  category: z.string().min(1).optional(),
  note: z.string().optional(),
  remarks: z.string().optional(),
  baseCurrency: currencyCode.optional(),
  currency: currencyCode.nullable().optional(),
  originalAmount: z.number().positive().nullable().optional(),
  rate: z.number().positive().nullable().optional(),
})

export const expenseController = {
  async createExpense(req: Request, res: Response) {
    const parsed = createExpenseSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const expense = await expenseModel.create(req.userId!, parsed.data)
      return res.status(201).json({ expense })
    } catch (err) {
      console.error('Error creating expense:', err)
      return res.status(500).json({ error: 'Failed to create expense' })
    }
  },

  async getExpenses(req: Request, res: Response) {
    const month = req.query.month as string

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month query param required (YYYY-MM)' })
    }

    try {
      const expenses = await expenseModel.getByMonth(req.userId!, month)
      return res.json({ expenses })
    } catch (err) {
      console.error('Error fetching expenses:', err)
      return res.status(500).json({ error: 'Failed to fetch expenses' })
    }
  },

  async updateExpense(req: Request, res: Response) {
    const id = req.params.id as string
    const date = req.query.date as string | undefined

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    }

    const parsed = updateExpenseSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const expense = await expenseModel.update(req.userId!, date, id, parsed.data)
      return res.json({ expense })
    } catch (err) {
      console.error('Error updating expense:', err)
      return res.status(500).json({ error: 'Failed to update expense' })
    }
  },

  async deleteExpense(req: Request, res: Response) {
    const id = req.params.id as string
    const date = req.query.date as string | undefined

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' })
    }

    try {
      await expenseModel.delete(req.userId!, date, id)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting expense:', err)
      return res.status(500).json({ error: 'Failed to delete expense' })
    }
  },

  async batchCreateExpenses(req: Request, res: Response) {
    const items = req.body.items as CreateExpenseInput[]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must not be empty' })
    }

    // Validate each item
    const validatedItems: CreateExpenseInput[] = []
    for (const item of items) {
      const parsed = createExpenseSchema.safeParse(item)
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid item in array',
          details: parsed.error.flatten(),
          item 
        })
      }
      validatedItems.push(parsed.data)
    }

    try {
      const expenses = await expenseModel.createMany(req.userId!, validatedItems)
      return res.status(201).json({ expenses })
    } catch (err) {
      console.error('Error batch creating expenses:', err)
      return res.status(500).json({ error: 'Failed to create expenses' })
    }
  },
}
