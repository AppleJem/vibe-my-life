import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import type { JwtPayload, LoginCredentials } from './auth.types.d.js'

export const authService = {
  async loginWithCredentials({ username, password }: LoginCredentials): Promise<string> {
    if (username !== env.LOGIN_USERNAME || password !== env.LOGIN_PASSWORD) {
      throw new Error('Invalid credentials')
    }

    const payload: JwtPayload = { userId: 'me', method: 'credentials' }
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' })
  },

  // Future: Google login
  // async loginWithGoogle(token: string): Promise<string> {
  //   // Verify Google token
  //   const payload: JwtPayload = { userId: 'me', method: 'google' }
  //   return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' })
  // },

  verify(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload
  },
}
