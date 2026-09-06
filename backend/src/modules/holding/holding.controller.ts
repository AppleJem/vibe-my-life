import type { Request, Response } from 'express'
import { z } from 'zod'
import { holdingModel } from './holding.model.js'

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')

/**
 * Tags are matched and grouped by exact string, so they are normalised here rather than
 * trusted from the client: "Fixed Deposit", "fixed  deposit" and " fixed deposit " all
 * have to land in the same pie slice. Display capitalisation is a render concern.
 */
export const normalizeTag = (tag: string): string =>
  tag.trim().replace(/\s+/g, ' ').toLowerCase()

const holdingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  // 0 is allowed: a matured deposit or an emptied fund is worth keeping on the list at
  // zero rather than deleting. The cap is a fat-finger bound, matching the budget's.
  amount: z
    .number()
    .finite()
    .min(0, 'Amount cannot be negative')
    .max(1_000_000_000_000, 'Amount is unrealistically large'),
  currency: currencyCode,
  tag: z.string().optional().default('').transform(normalizeTag),
  notes: z.string().optional().default(''),
})

/** The editor always sends the whole record, but a partial patch is valid. */
const updateSchema = holdingSchema.partial()

export const holdingController = {
  async list(req: Request, res: Response) {
    try {
      const holdings = await holdingModel.list(req.userId!)
      return res.json({ holdings })
    } catch (err) {
      console.error('Error fetching holdings:', err)
      return res.status(500).json({ error: 'Failed to fetch holdings' })
    }
  },

  async create(req: Request, res: Response) {
    const parsed = holdingSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const holding = await holdingModel.create(req.userId!, parsed.data)
      return res.status(201).json({ holding })
    } catch (err) {
      console.error('Error creating holding:', err)
      return res.status(500).json({ error: 'Failed to create holding' })
    }
  },

  async update(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const holding = await holdingModel.update(
        req.userId!,
        req.params.id as string,
        parsed.data
      )
      if (!holding) return res.status(404).json({ error: 'Holding not found' })

      return res.json({ holding })
    } catch (err) {
      console.error('Error updating holding:', err)
      return res.status(500).json({ error: 'Failed to update holding' })
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const removed = await holdingModel.remove(req.userId!, req.params.id as string)
      if (!removed) return res.status(404).json({ error: 'Holding not found' })

      return res.json({ deleted: true })
    } catch (err) {
      console.error('Error deleting holding:', err)
      return res.status(500).json({ error: 'Failed to delete holding' })
    }
  },
}
