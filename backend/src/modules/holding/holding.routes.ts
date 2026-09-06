import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { holdingController } from './holding.controller.js'

export const holdingRouter: IRouter = Router()

// All holding routes require auth
holdingRouter.use(authMiddleware)

holdingRouter.get('/', holdingController.list)
holdingRouter.post('/', holdingController.create)
holdingRouter.put('/:id', holdingController.update)
holdingRouter.delete('/:id', holdingController.remove)
