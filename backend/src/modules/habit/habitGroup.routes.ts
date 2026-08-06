import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { habitGroupController } from './habit.controller.js'

/**
 * Mounted at `/api/habit-groups` rather than nested under `/api/habits`, where
 * `/habits/groups/:id` would sit next to `/habits/:id/completions` and depend on
 * registration order to be told apart — the trap `GET /habits/completions` already has to
 * be hand-ordered around.
 *
 * Writes only: groups are read from `GET /habits`, which returns them with the habits.
 */
export const habitGroupRouter: IRouter = Router()

habitGroupRouter.use(authMiddleware)

habitGroupRouter.post('/', habitGroupController.createGroup)
habitGroupRouter.put('/:id', habitGroupController.updateGroup)
habitGroupRouter.delete('/:id', habitGroupController.deleteGroup)
