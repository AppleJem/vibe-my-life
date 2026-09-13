import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import type { JwtPayload, LoginCredentials } from './auth.types.d.js'

/**
 * Two lifetimes, deliberately different:
 *
 * - `SESSION_TTL` is what ordinary endpoints accept. A token lifted off a device stops
 *   working within a week.
 * - `ABSOLUTE_TTL` is how long a session may keep being *extended*. Renewal rewinds
 *   `exp` but never `iat`, so this is the hard ceiling on any one sign-in: use the app
 *   every day and you are never asked to log in again, disappear for a month and you are.
 */
const SESSION_TTL = '7d'
const ABSOLUTE_TTL = '30d'

export const authService = {
  async loginWithCredentials({ username, password }: LoginCredentials): Promise<string> {
    if (username !== env.LOGIN_USERNAME || password !== env.LOGIN_PASSWORD) {
      throw new Error('Invalid credentials')
    }

    return authService.issueToken('credentials')
  },

  /**
   * The single place a session token is minted. Passkey login calls this too, so both
   * routes produce an identical token and nothing downstream has to care which was used
   * — `method` is recorded for debugging, not read for authorisation.
   */
  issueToken(method: JwtPayload['method']): string {
    const payload: JwtPayload = { userId: 'me', method }
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: SESSION_TTL })
  },

  /**
   * Sliding renewal: swap a token for a fresh one with a new `exp`.
   *
   * `ignoreExpiration` is the whole point — an expired token is still a valid proof that
   * this device signed in, and rejecting it here is what made sessions end at a fixed
   * 7 days instead of whenever the user last opened the app. The signature is still
   * checked, and `maxAge` caps how far back `iat` may be, so a token cannot be renewed
   * forever.
   *
   * Returns null when the token is unusable, which the controller turns into a 401.
   */
  renew(token: string): string | null {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        ignoreExpiration: true,
        maxAge: ABSOLUTE_TTL,
      }) as JwtPayload

      return authService.issueToken(payload.method)
    } catch {
      return null
    }
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
