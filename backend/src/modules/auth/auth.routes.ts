import { Router, type IRouter } from 'express'
import { authController } from './auth.controller.js'

export const authRouter: IRouter = Router()

authRouter.post('/login', authController.login)
