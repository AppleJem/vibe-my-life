import type { Request, Response } from 'express'
import { voiceService, type VoiceCategory } from './voice.service.js'

export const voiceController = {
  async parseVoiceRecording(req: Request, res: Response) {
    const file = req.file as Express.Multer.File | undefined

    if (!file) {
      return res.status(400).json({ error: 'Audio file is required' })
    }

    // Validate audio MIME type (handle codec variants like 'audio/ogg;codecs=opus')
    const cleanMimeType = file.mimetype.split(';')[0].trim()
    const allowedMimes = [
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp3',
      'audio/m4a',
      'audio/x-m4a',
    ]

    if (!allowedMimes.includes(cleanMimeType)) {
      return res.status(400).json({
        error: 'Invalid audio format. Supported: webm, ogg, mp4, mpeg, wav, mp3, m4a',
      })
    }

    // Parse categories from request body
    let categories: VoiceCategory[] = []
    let incomeCategories: VoiceCategory[] = []
    try {
      if (req.body.categories) {
        categories = JSON.parse(req.body.categories)
      }
      if (req.body.incomeCategories) {
        incomeCategories = JSON.parse(req.body.incomeCategories)
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid categories format' })
    }

    // Currency context. Absent bodies fall back to the service defaults rather than
    // failing — an older client that doesn't send these still parses fine, it just
    // can't recognise foreign amounts.
    const baseCurrency =
      typeof req.body.baseCurrency === 'string' && /^[A-Za-z]{3}$/.test(req.body.baseCurrency)
        ? req.body.baseCurrency.toUpperCase()
        : undefined

    let currencies: string[] = []
    try {
      if (req.body.currencies) {
        const parsed = JSON.parse(req.body.currencies)
        if (Array.isArray(parsed)) {
          currencies = parsed.filter(
            (c): c is string => typeof c === 'string' && /^[A-Za-z]{3}$/.test(c)
          ).map((c) => c.toUpperCase())
        }
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid currencies format' })
    }

    // Log file info for debugging
    console.log('Received audio file:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      categoriesCount: categories.length,
      incomeCategoriesCount: incomeCategories.length,
      baseCurrency,
      currencies,
    })

    try {
      const { transcript, items } = await voiceService.parseVoiceRecording(
        file.buffer,
        file.mimetype,
        categories,
        incomeCategories,
        baseCurrency,
        currencies,
      )
      return res.json({ transcript, items })
    } catch (err: any) {
      console.error('Error parsing voice recording:', err)
      return res.status(500).json({
        error: err.message || 'Failed to parse voice recording',
      })
    }
  },
}
