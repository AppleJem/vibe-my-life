import type { Request, Response } from 'express'
import { screenshotService } from './screenshot.service.js'
import type { LLMProviderName } from '../llm/index.js'

export const screenshotController = {
  async parseScreenshots(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[] | undefined
    const provider = req.body.provider as LLMProviderName | undefined

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' })
    }

    if (files.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' })
    }

    try {
      const images = files.map((file) => file.buffer)
      const items = await screenshotService.parseScreenshots(images, provider)
      return res.json({ items })
    } catch (err: any) {
      console.error('Error parsing screenshots:', err)
      return res.status(500).json({
        error: err.message || 'Failed to parse screenshots',
      })
    }
  },
}
