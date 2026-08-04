import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { recurringController } from './recurring.controller.js'

export const recurringRouter: IRouter = Router()

// All recurring routes require auth
recurringRouter.use(authMiddleware)

recurringRouter.get('/', recurringController.listRules)
recurringRouter.post('/', recurringController.createRule)
// Catch-up: materialises everything the rules owe. Called on entry into the app.
recurringRouter.post('/run', recurringController.run)
recurringRouter.put('/:id', recurringController.updateRule)
recurringRouter.delete('/:id', recurringController.deleteRule)
