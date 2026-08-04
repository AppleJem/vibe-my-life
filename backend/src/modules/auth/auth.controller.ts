import type { Request, Response } from 'express'
import { z } from 'zod'
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
}
