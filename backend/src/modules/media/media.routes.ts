import { Router, type IRouter } from 'express'
import { authMiddleware } from '../../middleware/authMiddleware.js'
import { mediaController } from './media.controller.js'

/**
 * Generic object storage for the whole app, not a climbing-specific endpoint — the next
 * sub-app that needs a file wants exactly this.
 *
 * Nothing here proxies bytes. The browser uploads straight to S3 with a presigned `PUT` and
 * reads back through presigned `GET`s, so this router only ever signs, checks ownership,
 * and deletes.
 */
export const mediaRouter: IRouter = Router()

mediaRouter.use(authMiddleware)

mediaRouter.get('/status', mediaController.getStatus)
mediaRouter.post('/upload-url', mediaController.createUploadUrl)
mediaRouter.post('/view-urls', mediaController.createViewUrls)
mediaRouter.delete('/', mediaController.deleteObject)
