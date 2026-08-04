import type { Request, Response } from 'express'
import { z } from 'zod'
import { habitModel } from './habit.model.js'
import type { Completion, Habit, HabitType } from './habit.types.d.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const habitType = z.enum(['boolean', 'count', 'duration'])

const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  emoji: z.string().min(1, 'Emoji is required'),
  type: habitType,
  description: z.string().optional().default(''),
  unit: z.string().optional(),
  target: z.number().positive().optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  color: z.string().min(1).optional(),
})

// null on `unit`/`target` clears them — switching a count habit to boolean has to shed
// both rather than leave them stale.
const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().min(1).optional(),
  type: habitType.optional(),
  description: z.string().optional(),
  unit: z.string().nullable().optional(),
  target: z.number().positive().nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
  color: z.string().min(1).optional(),
  archived: z.boolean().optional(),
})

/**
 * `date` is the client's local day, not the server's. A UTC server would file a 10pm
 * SGT log under tomorrow — the same reason the recurring module takes `today` from the
 * client rather than computing it.
 */
const createCompletionSchema = z.object({
  date: isoDate,
  notes: z.string().optional().default(''),
  count: z.number().positive().optional(),
  durationMinutes: z.number().positive().optional(),
})

type CompletionBody = z.infer<typeof createCompletionSchema>

/**
 * The value a completion carries depends on the habit's type, which lives in the stored
 * definition rather than the request — so this runs after the habit is fetched, not as
 * part of the zod schema. Returns an error message, or null when the body is valid.
 */
function validateValue(type: HabitType, body: CompletionBody): string | null {
  switch (type) {
    case 'count':
      if (body.count === undefined) return 'count is required for a count habit'
      if (body.durationMinutes !== undefined) return 'durationMinutes is not valid for a count habit'
      return null
    case 'duration':
      if (body.durationMinutes === undefined) {
        return 'durationMinutes is required for a duration habit'
      }
      if (body.count !== undefined) return 'count is not valid for a duration habit'
      return null
    case 'boolean':
      if (body.count !== undefined || body.durationMinutes !== undefined) {
        return 'a boolean habit takes no value'
      }
      return null
  }
}

/** The newest local date across a set of completions, or null when there are none. */
const newestDate = (completions: Completion[]): string | null =>
  completions.reduce<string | null>(
    (newest, completion) => (newest === null || completion.date > newest ? completion.date : newest),
    null
  )

export const habitController = {
  async listHabits(req: Request, res: Response) {
    try {
      const habits = await habitModel.listHabits(req.userId!)
      return res.json({ habits })
    } catch (err) {
      console.error('Error fetching habits:', err)
      return res.status(500).json({ error: 'Failed to fetch habits' })
    }
  },

  async getHabit(req: Request, res: Response) {
    try {
      const habit = await habitModel.getHabit(req.userId!, req.params.id as string)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })
      return res.json({ habit })
    } catch (err) {
      console.error('Error fetching habit:', err)
      return res.status(500).json({ error: 'Failed to fetch habit' })
    }
  },

  async createHabit(req: Request, res: Response) {
    const parsed = createHabitSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    // A unit is meaningless on anything but a count habit, and carrying a stale one
    // would surface in the completion snapshot.
    const input = parsed.data.type === 'count' ? parsed.data : { ...parsed.data, unit: undefined }

    try {
      const habit = await habitModel.createHabit(req.userId!, input)
      return res.status(201).json({ habit })
    } catch (err) {
      console.error('Error creating habit:', err)
      return res.status(500).json({ error: 'Failed to create habit' })
    }
  },

  async updateHabit(req: Request, res: Response) {
    const parsed = updateHabitSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const id = req.params.id as string

    try {
      const existing = await habitModel.getHabit(req.userId!, id)
      if (!existing) return res.status(404).json({ error: 'Habit not found' })

      // Changing away from `count` clears the unit; the client doesn't have to remember.
      const nextType = parsed.data.type ?? existing.type
      const updates =
        nextType === 'count' ? parsed.data : { ...parsed.data, unit: null }

      const habit = await habitModel.updateHabit(req.userId!, id, updates)
      return res.json({ habit })
    } catch (err) {
      console.error('Error updating habit:', err)
      return res.status(500).json({ error: 'Failed to update habit' })
    }
  },

  async deleteHabit(req: Request, res: Response) {
    try {
      await habitModel.deleteHabit(req.userId!, req.params.id as string)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting habit:', err)
      return res.status(500).json({ error: 'Failed to delete habit' })
    }
  },

  async listCompletions(req: Request, res: Response) {
    try {
      const completions = await habitModel.listCompletions(req.userId!, req.params.id as string)
      return res.json({ completions })
    } catch (err) {
      console.error('Error fetching completions:', err)
      return res.status(500).json({ error: 'Failed to fetch completions' })
    }
  },

  async createCompletion(req: Request, res: Response) {
    const parsed = createCompletionSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const habitId = req.params.id as string

    try {
      const habit = await habitModel.getHabit(req.userId!, habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })

      const invalid = validateValue(habit.type, parsed.data)
      if (invalid) return res.status(400).json({ error: invalid })

      // One completion per day, enforced here and not only in the UI — the big check
      // box goes inert once a day is logged, and a stale client must not be able to
      // double-log by racing that.
      const existing = await habitModel.listCompletions(req.userId!, habitId)
      if (existing.some((completion) => completion.date === parsed.data.date)) {
        return res.status(409).json({ error: 'Already logged for this day' })
      }

      const completion = await habitModel.createCompletion(
        req.userId!,
        habitId,
        parsed.data,
        habit.type === 'count' ? habit.unit : undefined
      )

      // Backfilling an older day must not drag the watermark backwards.
      const updated: Habit =
        completion.date > (habit.lastCompletedDate ?? '')
          ? await habitModel.touchLastCompleted(req.userId!, habitId, completion.date)
          : habit

      return res.status(201).json({ completion, habit: updated })
    } catch (err) {
      console.error('Error creating completion:', err)
      return res.status(500).json({ error: 'Failed to create completion' })
    }
  },

  async deleteCompletion(req: Request, res: Response) {
    const habitId = req.params.id as string
    const timestamp = req.params.timestamp as string

    try {
      const habit = await habitModel.getHabit(req.userId!, habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })

      await habitModel.deleteCompletion(req.userId!, habitId, timestamp)

      // The watermark can only move backwards from here, and only the surviving rows
      // know where to. This is why undo lives on the detail page: those rows are
      // already loaded there.
      const remaining = await habitModel.listCompletions(req.userId!, habitId)
      const updated = await habitModel.touchLastCompleted(
        req.userId!,
        habitId,
        newestDate(remaining)
      )

      return res.json({ habit: updated })
    } catch (err) {
      console.error('Error deleting completion:', err)
      return res.status(500).json({ error: 'Failed to delete completion' })
    }
  },
}
