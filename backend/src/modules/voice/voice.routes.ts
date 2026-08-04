import { Router, type IRouter } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { voiceController } from './voice.controller.js'

// Audio files are held in memory and never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Groq's limit)
  },
  fileFilter: (_req, file, cb) => {
    console.log('Multer received file:', file.fieldname, file.mimetype)
    // Handle MIME types with codecs (e.g., 'audio/ogg;codecs=opus')
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
    if (allowedMimes.includes(cleanMimeType)) {
      cb(null, true)
    } else {
      cb(new Error(`Only audio files are allowed. Received: ${cleanMimeType}`))
    }
  },
})

export const voiceRouter: IRouter = Router()

// Log all requests to this router
voiceRouter.use((req, _res, next) => {
  console.log(`[Voice Router] ${req.method} ${req.path}`)
  next()
})

voiceRouter.use(authMiddleware)

voiceRouter.post('/parse', upload.single('audio'), voiceController.parseVoiceRecording)
