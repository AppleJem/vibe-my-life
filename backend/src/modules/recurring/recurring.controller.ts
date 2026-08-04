import type { Request, Response } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { expenseModel } from '../expense/expense.model.js'
import type {
  Expense,
  ImportExpenseInput,
  UpdateExpenseInput,
} from '../expense/expense.types.d.js'
import { recurringModel } from './recurring.model.js'
import { dueOccurrences, latestOccurrenceOnOrBefore } from './recurring.schedule.js'
import type { RecurringRule } from './recurring.types.d.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')

const ruleSchema = z.object({
  type: z.enum(['expense', 'income']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: isoDate,
  amount: z.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  note: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  baseCurrency: currencyCode.optional(),
  // null is how the client says "this rule is back in the base currency", mirroring
  // the expense update schema.
  currency: currencyCode.nullable().optional(),
  originalAmount: z.number().positive().nullable().optional(),
  rate: z.number().positive().nullable().optional(),
})

const runSchema = z.object({
  /** The *client's* local today — a UTC server must not decide when a day rolls over. */
  today: isoDate,
})

const updateSchema = ruleSchema.extend({
  propagate: z.enum(['none', 'future', 'all']).optional().default('none'),
  /** Lower bound for `propagate: 'future'`, by occurrence date. Defaults to `today`. */
  from: isoDate.optional(),
  today: isoDate,
})

type RuleInput = z.infer<typeof ruleSchema>

const monthOf = (date: string) => date.slice(0, 7)

/** Drops the nulls the client uses to clear foreign-currency fields. */
const currencyFields = (input: RuleInput) => ({
  ...(input.baseCurrency != null && { baseCurrency: input.baseCurrency }),
  ...(input.currency != null && { currency: input.currency }),
  ...(input.originalAmount != null && { originalAmount: input.originalAmount }),
  ...(input.rate != null && { rate: input.rate }),
})

/** One generated transaction. `occurrenceDate` mirrors `date` only at birth. */
const toExpenseInput = (rule: RecurringRule, date: string): ImportExpenseInput => ({
  date,
  amount: rule.amount,
  type: rule.type,
  category: rule.category,
  note: rule.note,
  remarks: rule.remarks,
  ...(rule.baseCurrency !== undefined && { baseCurrency: rule.baseCurrency }),
  ...(rule.currency !== undefined && { currency: rule.currency }),
  ...(rule.originalAmount !== undefined && { originalAmount: rule.originalAmount }),
  ...(rule.rate !== undefined && { rate: rule.rate }),
  recurringId: rule.id,
  occurrenceDate: date,
})

/**
 * Writes everything the given rules owe up to `today` and returns the rules with their
 * watermarks advanced. The caller is responsible for persisting them.
 *
 * Rows are written *before* the watermark moves, deliberately: a failure between the two
 * can duplicate an occurrence on the next app entry, which the user can see and delete,
 * whereas advancing the watermark first would silently drop a transaction from the
 * ledger forever.
 */
async function materialise(
  userId: string,
  rules: RecurringRule[],
  today: string
): Promise<{ created: Expense[]; rules: RecurringRule[] }> {
  const inputs: ImportExpenseInput[] = []
  const next: RecurringRule[] = []

  for (const rule of rules) {
    const due = dueOccurrences(rule, today)
    if (due.length === 0) {
      next.push(rule)
      continue
    }

    inputs.push(...due.map((date) => toExpenseInput(rule, date)))
    next.push({ ...rule, lastRunDate: due[due.length - 1] })
  }

  const created = inputs.length > 0 ? await expenseModel.createMany(userId, inputs) : []

  return { created, rules: next }
}

export const recurringController = {
  async listRules(req: Request, res: Response) {
    try {
      const rules = await recurringModel.list(req.userId!)
      return res.json({ rules })
    } catch (err) {
      console.error('Error fetching recurring rules:', err)
      return res.status(500).json({ error: 'Failed to fetch recurring items' })
    }
  },

  async createRule(req: Request, res: Response) {
    const parsed = ruleSchema.extend({ today: isoDate }).safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const { today, ...input } = parsed.data
    const now = new Date().toISOString()

    const rule: RecurringRule = {
      id: uuidv4(),
      type: input.type,
      frequency: input.frequency,
      startDate: input.startDate,
      amount: input.amount,
      category: input.category,
      note: input.note,
      remarks: input.remarks,
      ...currencyFields(input),
      createdAt: now,
      updatedAt: now,
    }

    try {
      // A rule starting today (or earlier) produces its first transaction straight away,
      // which is what makes "save" on the modal feel like an ordinary entry. A rule
      // starting later produces nothing until catch-up reaches that date.
      const { created, rules } = await materialise(req.userId!, [rule], today)
      await recurringModel.save(req.userId!, rules[0])

      return res.status(201).json({
        rule: rules[0],
        created,
        months: [...new Set(created.map((e) => monthOf(e.date)))],
      })
    } catch (err) {
      console.error('Error creating recurring rule:', err)
      return res.status(500).json({ error: 'Failed to create recurring item' })
    }
  },

  /** Catch-up. Called once per day per client session, on entry into the app. */
  async run(req: Request, res: Response) {
    const parsed = runSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const rules = await recurringModel.list(req.userId!)

      if (rules.length === 0) {
        return res.json({ created: [], months: [] })
      }

      const result = await materialise(req.userId!, rules, parsed.data.today)

      if (result.created.length > 0) {
        await recurringModel.saveAll(req.userId!, result.rules)
      }

      return res.json({
        created: result.created,
        months: [...new Set(result.created.map((e) => monthOf(e.date)))],
      })
    } catch (err) {
      console.error('Error running recurring catch-up:', err)
      return res.status(500).json({ error: 'Failed to apply recurring items' })
    }
  },

  async updateRule(req: Request, res: Response) {
    const ruleId = req.params.id as string
    const parsed = updateSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const { propagate, today, from, ...input } = parsed.data

    try {
      const existing = (await recurringModel.list(req.userId!)).find((r) => r.id === ruleId)
      if (!existing) return res.status(404).json({ error: 'Recurring item not found' })

      const rescheduled =
        input.frequency !== existing.frequency || input.startDate !== existing.startDate

      const rule: RecurringRule = {
        ...existing,
        type: input.type,
        frequency: input.frequency,
        startDate: input.startDate,
        amount: input.amount,
        category: input.category,
        note: input.note,
        remarks: input.remarks,
        ...currencyFields(input),
        // A new schedule takes effect going forward only — re-anchoring the watermark to
        // the new schedule's latest past occurrence stops "monthly since 2024" turned
        // daily from backfilling several hundred rows on the next app entry.
        ...(rescheduled && {
          lastRunDate: latestOccurrenceOnOrBefore(input.startDate, input.frequency, today),
        }),
        updatedAt: new Date().toISOString(),
      }

      // The currency fields are conditionally spread, so an edit back to the base
      // currency has to explicitly drop what the old rule carried.
      if (input.currency == null) {
        delete rule.currency
        delete rule.originalAmount
        delete rule.rate
      }

      let updatedCount = 0
      let months: string[] = []

      if (propagate !== 'none') {
        const lowerBound = from ?? today
        const items = (await recurringModel.itemsForRule(req.userId!, ruleId)).filter(
          (item) => propagate === 'all' || (item.occurrenceDate ?? item.date) >= lowerBound
        )

        updatedCount = await recurringModel.applyToItems(req.userId!, items, ruleUpdates(rule))
        months = [...new Set(items.map((item) => monthOf(item.date)))]
      }

      await recurringModel.save(req.userId!, rule)

      return res.json({ rule, updatedCount, months })
    } catch (err) {
      console.error('Error updating recurring rule:', err)
      return res.status(500).json({ error: 'Failed to update recurring item' })
    }
  },

  async deleteRule(req: Request, res: Response) {
    const ruleId = req.params.id as string
    const deleteItems = req.query.deleteItems === 'true'

    try {
      const items = await recurringModel.itemsForRule(req.userId!, ruleId)

      if (deleteItems) {
        await recurringModel.deleteItems(req.userId!, items)
      } else {
        // Kept rows are detached from the rule that is about to disappear — a dangling
        // `recurringId` would still show the repeat badge and offer a scope prompt for a
        // schedule that no longer exists.
        await recurringModel.applyToItems(req.userId!, items, {
          recurringId: null,
          occurrenceDate: null,
        })
      }

      const removed = await recurringModel.remove(req.userId!, ruleId)
      if (!removed) return res.status(404).json({ error: 'Recurring item not found' })

      return res.json({
        deleted: deleteItems ? items.length : 0,
        detached: deleteItems ? 0 : items.length,
        months: [...new Set(items.map((item) => monthOf(item.date)))],
      })
    } catch (err) {
      console.error('Error deleting recurring rule:', err)
      return res.status(500).json({ error: 'Failed to delete recurring item' })
    }
  },
}

/**
 * The slice of a rule that is stamped onto its existing rows. `date` is deliberately
 * absent: an occurrence's date belongs to the occurrence, and rescheduling a rule never
 * drags already-written history around.
 */
function ruleUpdates(rule: RecurringRule): UpdateExpenseInput {
  return {
    amount: rule.amount,
    type: rule.type,
    category: rule.category,
    note: rule.note,
    remarks: rule.remarks,
    baseCurrency: rule.baseCurrency,
    currency: rule.currency ?? null,
    originalAmount: rule.originalAmount ?? null,
    rate: rule.rate ?? null,
  }
}
