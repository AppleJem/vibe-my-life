import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { expenseController } from './expense.controller.js'

export const expenseRouter: IRouter = Router()

// All expense routes require auth
expenseRouter.use(authMiddleware)

expenseRouter.get('/', expenseController.getExpenses)
expenseRouter.post('/', expenseController.createExpense)
expenseRouter.put('/:id', expenseController.updateExpense)
expenseRouter.delete('/:id', expenseController.deleteExpense)
expenseRouter.post('/batch', expenseController.batchCreateExpenses)
