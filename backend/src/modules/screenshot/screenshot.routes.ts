import { Router, type IRouter } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { screenshotController } from './screenshot.controller.js'

// Images are held in memory and never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
})

export const screenshotRouter: IRouter = Router()

screenshotRouter.use(authMiddleware)

screenshotRouter.post(
  '/parse',
  upload.array('images', 5),
  screenshotController.parseScreenshots
)
