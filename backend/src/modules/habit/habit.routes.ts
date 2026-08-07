import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { habitController } from './habit.controller.js'

export const habitRouter: IRouter = Router()

// All habit routes require auth
habitRouter.use(authMiddleware)

habitRouter.get('/', habitController.listHabits)
habitRouter.post('/', habitController.createHabit)

// Must precede `/:id` — Express matches in registration order, and this path would
// otherwise be read as a habit whose id is "completions".
habitRouter.get('/completions', habitController.listRecentCompletions)

habitRouter.get('/:id', habitController.getHabit)
habitRouter.put('/:id', habitController.updateHabit)
habitRouter.delete('/:id', habitController.deleteHabit)

habitRouter.get('/:id/completions', habitController.listCompletions)
habitRouter.post('/:id/completions', habitController.createCompletion)
// The timestamp is an ISO string, so the client has to encodeURIComponent it.
habitRouter.put('/:id/completions/:timestamp', habitController.updateCompletion)
habitRouter.delete('/:id/completions/:timestamp', habitController.deleteCompletion)
