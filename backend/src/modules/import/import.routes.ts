import { Router, type IRouter } from 'express'
import multer from 'multer'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { importController } from './import.controller.js'

// Backups are small (a year of expenses is well under 100KB), so the whole file is
// held in memory and never touches disk. The cap is generous enough for several
// years of history while still bounding what an upload can allocate.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
})

export const importRouter: IRouter = Router()

importRouter.use(authMiddleware)

importRouter.post('/analyze', upload.single('file'), importController.analyze)
importRouter.post('/commit', upload.single('file'), importController.commit)
