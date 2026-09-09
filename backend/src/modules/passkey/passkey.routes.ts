import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { passkeyController } from './passkey.controller.js'

export const passkeyRouter: IRouter = Router()

// Public — these are the login half, and run before any token exists.
passkeyRouter.get('/status', passkeyController.status)
passkeyRouter.post('/login/options', passkeyController.authenticationOptions)
passkeyRouter.post('/login/verify', passkeyController.verifyAuthentication)

// Everything below enrolls or revokes a credential, so it requires an existing
// session: a passkey can only be added by someone who already signed in. Without
// this, anyone who reached the API could register their own face and own the account.
passkeyRouter.use(authMiddleware)

passkeyRouter.get('/', passkeyController.list)
passkeyRouter.post('/register/options', passkeyController.registrationOptions)
passkeyRouter.post('/register/verify', passkeyController.verifyRegistration)
passkeyRouter.delete('/:id', passkeyController.remove)
