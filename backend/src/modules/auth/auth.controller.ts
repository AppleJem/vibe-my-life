import type { Request, Response } from 'express'
import { z } from 'zod'
import { readBearerToken } from '../../middleware/authMiddleware.js'
import { authService } from './auth.service.js'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const authController = {
  async login(req: Request, res: Response) {
    console.log('login', req.body)
    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
      console.log('parsed', parsed.error)
      return res.status(400).json({ error: 'Username and password are required' })
    }

    try {
      const token = await authService.loginWithCredentials(parsed.data)
      console.log('Login successful', token)
      return res.json({ token })
    } catch {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
  },

  /**
   * Trades the caller's token for a freshly dated one. Deliberately not behind
   * `authMiddleware`: that would 401 the expired tokens this endpoint exists to accept.
   */
  async refresh(req: Request, res: Response) {
    const token = readBearerToken(req)

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const renewed = authService.renew(token)

    if (!renewed) {
      return res.status(401).json({ error: 'Session expired' })
    }

    return res.json({ token: renewed })
  },
}
