import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { climbingController } from './climbing.controller.js'

export const climbingRouter: IRouter = Router()

climbingRouter.use(authMiddleware)

climbingRouter.get('/', climbingController.listSessions)
climbingRouter.post('/', climbingController.createSession)
climbingRouter.get('/:id', climbingController.getSession)
climbingRouter.put('/:id', climbingController.updateSession)
climbingRouter.delete('/:id', climbingController.deleteSession)
