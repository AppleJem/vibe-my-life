import type { Request, Response } from 'express'
import { z } from 'zod'
import { expenseModel } from './expense.model.js'

const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  amount: z.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  note: z.string().optional().default(''),
})

const updateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  note: z.string().optional(),
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
}
