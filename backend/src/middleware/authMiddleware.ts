import type { Request, Response, NextFunction } from 'express'
import { authService } from '../modules/auth/auth.service.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)

  try {
    const payload = authService.verify(token)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
