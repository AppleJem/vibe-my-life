import type { Request, Response } from 'express'
import { z } from 'zod'
import { habitGroupModel, habitModel } from './habit.model.js'
import type { Completion, Habit, HabitType } from './habit.types.d.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const habitType = z.enum(['boolean', 'count', 'duration'])

/** Absent is `build`; only `avoid` habits send it. */
const habitPolarity = z.enum(['build', 'avoid'])

/** The stored colour is the hex itself — there is no palette key to look up any more. */
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a #rrggbb hex')

const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  emoji: z.string().min(1, 'Emoji is required'),
  type: habitType,
  polarity: habitPolarity.optional(),
  startDate: isoDate.optional(),
  description: z.string().optional().default(''),
  unit: z.string().optional(),
  target: z.number().positive().optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  groupId: z.string().min(1).nullable().optional(),
  color: hexColor.optional(),
})

// null on `unit`/`target` clears them — switching a count habit to boolean has to shed
// both rather than leave them stale.
const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().min(1).optional(),
  type: habitType.optional(),
  polarity: habitPolarity.optional(),
  // null clears it — a habit switched back to `build` has no clean run to anchor.
  startDate: isoDate.nullable().optional(),
  description: z.string().optional(),
  unit: z.string().nullable().optional(),
  target: z.number().positive().nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
  // null drops the habit out of its group without clearing anything else.
  groupId: z.string().min(1).nullable().optional(),
  color: hexColor.optional(),
  archived: z.boolean().optional(),
})

const createHabitGroupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

const updateHabitGroupSchema = z.object({
  name: z.string().min(1).optional(),
  habitIds: z.array(z.string().min(1)).optional(),
})

/**
 * A step in a habit's routine. `durationSeconds` present makes it a timed step; absent
 * makes it one you check off. The upper bound is a day — a countdown longer than that is
 * a typo, not a routine.
 */
const actionItemSchema = z.object({
  // Absent on a step the editor just added; the model assigns one.
  id: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  durationSeconds: z.number().int().positive().max(86_400).optional(),
})

/** The array is the order. A save replaces the list, so there is nothing else to send. */
const saveActionListSchema = z.object({
  items: z.array(actionItemSchema),
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
 * An edit corrects a value or a note on a completion that already exists. Every field is
 * optional — changing only the note leaves the value alone — but `date` is not among
 * them: it is part of the sort key and the subject of the one-per-day rule.
 */
const updateCompletionSchema = z.object({
  notes: z.string().optional(),
  count: z.number().positive().optional(),
  durationMinutes: z.number().positive().optional(),
})

type UpdateCompletionBody = z.infer<typeof updateCompletionSchema>

/**
 * The type check for an edit, which differs from a create: a count habit's completion
 * must already carry a count, so omitting it here means "leave it alone" rather than
 * "log without a value". Only the wrong *kind* of value is an error.
 */
function validateUpdateValue(type: HabitType, body: UpdateCompletionBody): string | null {
  if (type !== 'count' && body.count !== undefined) {
    return 'count is not valid for a non-count habit'
  }
  if (type !== 'duration' && body.durationMinutes !== undefined) {
    return 'durationMinutes is not valid for a non-duration habit'
  }
  return null
}

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
  /**
   * Habits *and* groups, in one response.
   *
   * Groups are not fetched separately and never per-habit: everything the list page, the
   * group page, and the form's group picker need is here, so opening a group is a cache
   * read rather than another round trip. The two prefix queries run concurrently — they
   * hit the same partition and neither depends on the other.
   */
  async listHabits(req: Request, res: Response) {
    try {
      const [habits, groups] = await Promise.all([
        habitModel.listHabits(req.userId!),
        habitGroupModel.listGroups(req.userId!),
      ])

      return res.json({ habits, groups })
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
      console.warn('Rejected habit create:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    // An avoid habit records slips, and a slip is "it happened" — there is nothing to
    // count or time. Forced here rather than trusted from the form for the same reason
    // the unit strip below is: the client must not be the only thing keeping a stored
    // habit coherent.
    const normalised =
      parsed.data.polarity === 'avoid'
        ? { ...parsed.data, type: 'boolean' as const, unit: undefined, target: undefined }
        : parsed.data

    // A unit is meaningless on anything but a count habit, and carrying a stale one
    // would surface in the completion snapshot.
    const input = normalised.type === 'count' ? normalised : { ...normalised, unit: undefined }

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
      // A rejected body used to leave nothing in the log at all, so a 400 in the browser
      // had no server-side counterpart to read.
      console.warn('Rejected habit update:', parsed.error.flatten())
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

  /**
   * Every habit's recent completions in one call, for the list page's week strip.
   * Routed before `GET /:id`, or Express would match this as a habit called
   * "completions".
   */
  async listRecentCompletions(req: Request, res: Response) {
    const parsed = isoDate.safeParse(req.query.since)

    if (!parsed.success) {
      return res.status(400).json({ error: 'since must be a YYYY-MM-DD date' })
    }

    try {
      const completions = await habitModel.listRecentCompletions(req.userId!, parsed.data)
      return res.json({ completions })
    } catch (err) {
      console.error('Error fetching recent completions:', err)
      return res.status(500).json({ error: 'Failed to fetch completions' })
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

  async updateCompletion(req: Request, res: Response) {
    const habitId = req.params.id as string
    const timestamp = req.params.timestamp as string

    const parsed = updateCompletionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const habit = await habitModel.getHabit(req.userId!, habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })

      const invalid = validateUpdateValue(habit.type, parsed.data)
      if (invalid) return res.status(400).json({ error: invalid })

      const completion = await habitModel.updateCompletion(
        req.userId!,
        habitId,
        timestamp,
        parsed.data
      )
      if (!completion) return res.status(404).json({ error: 'Completion not found' })

      // No watermark work: an edit can't move a completion to another day, so
      // `lastCompletedDate` is unaffected by definition.
      return res.json({ completion })
    } catch (err) {
      console.error('Error updating completion:', err)
      return res.status(500).json({ error: 'Failed to update completion' })
    }
  },

  /**
   * Every routine the user has. Routed before `GET /:id`, or Express would read this as a
   * habit whose id is "actions" — the same collision `/habits/completions` sits behind.
   */
  async listActionLists(req: Request, res: Response) {
    try {
      const actionLists = await habitModel.listActionLists(req.userId!)
      return res.json({ actionLists })
    } catch (err) {
      console.error('Error fetching action lists:', err)
      return res.status(500).json({ error: 'Failed to fetch action lists' })
    }
  },

  /** `actionList` is null when the habit has no routine — the client hides exercise mode. */
  async getActionList(req: Request, res: Response) {
    try {
      const actionList = await habitModel.getActionList(req.userId!, req.params.id as string)
      return res.json({ actionList })
    } catch (err) {
      console.error('Error fetching action list:', err)
      return res.status(500).json({ error: 'Failed to fetch action list' })
    }
  },

  /**
   * Replaces the whole routine. Saving an empty list deletes it outright rather than
   * storing a routine with no steps — an empty list and no list mean the same thing to
   * every reader, and only one of them can be reached twice.
   */
  async saveActionList(req: Request, res: Response) {
    const parsed = saveActionListSchema.safeParse(req.body)

    if (!parsed.success) {
      console.warn('Rejected action list save:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const habitId = req.params.id as string

    try {
      const habit = await habitModel.getHabit(req.userId!, habitId)
      if (!habit) return res.status(404).json({ error: 'Habit not found' })

      if (parsed.data.items.length === 0) {
        await habitModel.deleteActionList(req.userId!, habitId)
        return res.json({ actionList: null })
      }

      const actionList = await habitModel.saveActionList(req.userId!, habitId, parsed.data)
      return res.json({ actionList })
    } catch (err) {
      console.error('Error saving action list:', err)
      return res.status(500).json({ error: 'Failed to save action list' })
    }
  },

  /** The habit and its history are untouched; it just stops having a routine. */
  async deleteActionList(req: Request, res: Response) {
    try {
      await habitModel.deleteActionList(req.userId!, req.params.id as string)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting action list:', err)
      return res.status(500).json({ error: 'Failed to delete action list' })
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

/**
 * Writes only. Reading groups goes through `GET /habits`, which returns them alongside the
 * habits — a group endpoint that served its own members would put the list page back to one
 * request per group.
 */
export const habitGroupController = {
  async createGroup(req: Request, res: Response) {
    const parsed = createHabitGroupSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const group = await habitGroupModel.createGroup(req.userId!, parsed.data)
      return res.status(201).json({ group })
    } catch (err) {
      console.error('Error creating habit group:', err)
      return res.status(500).json({ error: 'Failed to create group' })
    }
  },

  async updateGroup(req: Request, res: Response) {
    const parsed = updateHabitGroupSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const id = req.params.id as string

    try {
      const existing = await habitGroupModel.getGroup(req.userId!, id)
      if (!existing) return res.status(404).json({ error: 'Group not found' })

      const group = await habitGroupModel.updateGroup(req.userId!, id, parsed.data)
      return res.json({ group })
    } catch (err) {
      console.error('Error updating habit group:', err)
      return res.status(500).json({ error: 'Failed to update group' })
    }
  },

  /** The habits survive; they come back ungrouped. */
  async deleteGroup(req: Request, res: Response) {
    try {
      await habitGroupModel.deleteGroup(req.userId!, req.params.id as string)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting habit group:', err)
      return res.status(500).json({ error: 'Failed to delete group' })
    }
  },
}
