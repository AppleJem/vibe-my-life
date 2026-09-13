import type { Request, Response, NextFunction } from 'express'
import { authService } from '../modules/auth/auth.service.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

/**
 * Pulls the bearer token off a request, or null when there isn't one. Shared so the
 * renewal endpoint can read a token that `authMiddleware` would have rejected for
 * being expired — renewal is exactly the case where an expired token is expected.
 */
export function readBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  return authHeader.slice(7)
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = readBearerToken(req)

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  try {
    const payload = authService.verify(token)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
