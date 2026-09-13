import type { Request, Response } from 'express'
import { z } from 'zod'
import { climbingModel } from './climbing.model.js'

/** Local calendar date, the same shape the habit controller validates. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

const mediaSchema = z.object({
  id: z.string().min(1).optional(),
  // The controller only checks the shape; `mediaController.assertOwnedKey` is what decides
  // whether a key is *this* user's, and it runs before any URL is ever signed for it.
  key: z.string().min(1).max(512),
  kind: z.enum(['image', 'video']),
  contentType: z.string().min(1).max(120),
  // The thumbnail's own object, checked for ownership exactly like `key` when it is signed.
  posterKey: z.string().min(1).max(512).optional(),
})

const climbSchema = z.object({
  // Present on an edit, absent on a row the session screen just added.
  id: z.string().min(1).optional(),
  /**
   * Optional: a climb created only to hold a video has no result yet, and recording the
   * clip is the reason to log it at all. Whether a nameless climb is acceptable is the
   * client's call, not the API's.
   */
  outcome: z.enum(['flashed', 'solved', 'projecting', 'attempted', 'given-up']).optional(),
  // Free text in both grade kinds — an integer session sends "5", not 5.
  grade: z.string().max(24).optional(),
  description: z.string().max(2000).optional(),
  media: z.array(mediaSchema).max(20).optional(),
})

const sessionSchema = z.object({
  date: isoDate,
  location: z.string().trim().min(1, 'Location is required').max(120),
  gradeSystem: z.string().trim().min(1, 'Grade system is required').max(40),
  gradeKind: z.enum(['integer', 'string']),
  // A session opens empty and fills up as you climb, so zero climbs is a valid save.
  climbs: z.array(climbSchema).max(200),
})

export const climbingController = {
  async listSessions(req: Request, res: Response) {
    try {
      const sessions = await climbingModel.listSessions(req.userId!)
      return res.json({ sessions })
    } catch (err) {
      console.error('Error fetching climbing sessions:', err)
      return res.status(500).json({ error: 'Failed to fetch sessions' })
    }
  },

  async getSession(req: Request, res: Response) {
    try {
      const session = await climbingModel.getSession(req.userId!, req.params.id as string)
      if (!session) return res.status(404).json({ error: 'Session not found' })
      return res.json({ session })
    } catch (err) {
      console.error('Error fetching climbing session:', err)
      return res.status(500).json({ error: 'Failed to fetch session' })
    }
  },

  async createSession(req: Request, res: Response) {
    const parsed = sessionSchema.safeParse(req.body)

    if (!parsed.success) {
      console.warn('Rejected session create:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const session = await climbingModel.createSession(req.userId!, parsed.data)
      return res.status(201).json({ session })
    } catch (err) {
      console.error('Error creating climbing session:', err)
      return res.status(500).json({ error: 'Failed to create session' })
    }
  },

  /** A save replaces the session — see `climbingModel.updateSession`. */
  async updateSession(req: Request, res: Response) {
    const parsed = sessionSchema.safeParse(req.body)

    if (!parsed.success) {
      console.warn('Rejected session update:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const session = await climbingModel.updateSession(
        req.userId!,
        req.params.id as string,
        parsed.data
      )
      if (!session) return res.status(404).json({ error: 'Session not found' })
      return res.json({ session })
    } catch (err) {
      console.error('Error updating climbing session:', err)
      return res.status(500).json({ error: 'Failed to update session' })
    }
  },

  async deleteSession(req: Request, res: Response) {
    try {
      await climbingModel.deleteSession(req.userId!, req.params.id as string)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting climbing session:', err)
      return res.status(500).json({ error: 'Failed to delete session' })
    }
  },
}
