import type { Request, Response } from 'express'
import { z } from 'zod'
import { mediaEnabled } from '../../config/env.js'
import { mediaService, ownsKey } from './media.service.js'

const uploadUrlSchema = z.object({
  contentType: z.string().min(1).max(120),
})

const viewUrlsSchema = z.object({
  // One session screen's worth. Beyond this the page should be paginating, not signing more.
  keys: z.array(z.string().min(1).max(512)).max(100),
})

const deleteSchema = z.object({
  key: z.string().min(1).max(512),
})

/** Answers every media request the same way when there's no bucket behind them. */
function unavailable(res: Response) {
  return res.status(503).json({ error: 'Media storage is not configured' })
}

export const mediaController = {
  /** Whether uploads are possible at all, so the UI can hide the buttons rather than fail. */
  async getStatus(_req: Request, res: Response) {
    return res.json({ enabled: mediaEnabled })
  },

  async createUploadUrl(req: Request, res: Response) {
    if (!mediaEnabled) return unavailable(res)

    const parsed = uploadUrlSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    if (!mediaService.kindFor(parsed.data.contentType)) {
      return res.status(400).json({
        error: `Unsupported file type: ${parsed.data.contentType}`,
      })
    }

    try {
      const upload = await mediaService.createUploadUrl(req.userId!, parsed.data.contentType)
      return res.json(upload)
    } catch (err) {
      console.error('Error creating upload URL:', err)
      return res.status(500).json({ error: 'Failed to create an upload URL' })
    }
  },

  /**
   * Read URLs for keys this user owns. A key outside their prefix fails the whole request
   * rather than being quietly dropped: a page asking for someone else's object is a bug or
   * an attempt, and neither should get a partial success back.
   */
  async createViewUrls(req: Request, res: Response) {
    if (!mediaEnabled) return unavailable(res)

    const parsed = viewUrlsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const foreign = parsed.data.keys.filter((key) => !ownsKey(req.userId!, key))
    if (foreign.length > 0) {
      console.warn(`Refused to sign ${foreign.length} key(s) outside user ${req.userId}`)
      return res.status(403).json({ error: 'Not your media' })
    }

    try {
      const urls = await mediaService.createViewUrls(parsed.data.keys)
      return res.json({ urls })
    } catch (err) {
      console.error('Error creating view URLs:', err)
      return res.status(500).json({ error: 'Failed to create view URLs' })
    }
  },

  async deleteObject(req: Request, res: Response) {
    if (!mediaEnabled) return unavailable(res)

    const parsed = deleteSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    if (!ownsKey(req.userId!, parsed.data.key)) {
      console.warn(`Refused to delete a key outside user ${req.userId}`)
      return res.status(403).json({ error: 'Not your media' })
    }

    try {
      await mediaService.deleteObject(parsed.data.key)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting media:', err)
      return res.status(500).json({ error: 'Failed to delete the file' })
    }
  },
}
