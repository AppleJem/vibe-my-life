import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { habitController } from './habit.controller.js'

export const habitRouter: IRouter = Router()

// All habit routes require auth
habitRouter.use(authMiddleware)

habitRouter.get('/', habitController.listHabits)
habitRouter.post('/', habitController.createHabit)
habitRouter.get('/:id', habitController.getHabit)
habitRouter.put('/:id', habitController.updateHabit)
habitRouter.delete('/:id', habitController.deleteHabit)

habitRouter.get('/:id/completions', habitController.listCompletions)
habitRouter.post('/:id/completions', habitController.createCompletion)
// The timestamp is an ISO string, so the client has to encodeURIComponent it.
habitRouter.delete('/:id/completions/:timestamp', habitController.deleteCompletion)
