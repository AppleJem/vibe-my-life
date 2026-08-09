import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { metadataController } from './metadata.controller.js'

export const metadataRouter: IRouter = Router()

// All metadata routes require auth
metadataRouter.use(authMiddleware)

metadataRouter.get('/', metadataController.getMetadata)
metadataRouter.put('/categories', metadataController.saveCategories)
metadataRouter.put('/currency', metadataController.saveCurrency)
metadataRouter.put('/budget', metadataController.saveBudget)
