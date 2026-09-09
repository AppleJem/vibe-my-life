import type { Request, Response } from 'express'
import { z } from 'zod'
import { passkeysEnabled } from '../../config/env.js'
import { passkeyService, PasskeyError } from './passkey.service.js'

// The WebAuthn response objects are validated by the library itself against the
// challenge, so these schemas only check the envelope enough to hand it over.
const registerSchema = z.object({
  response: z.record(z.unknown()),
  name: z.string().max(60).optional(),
})

const loginSchema = z.object({
  response: z.record(z.unknown()),
})

const fail = (res: Response, error: unknown) => {
  if (error instanceof PasskeyError) {
    return res.status(error.status).json({ error: error.message })
  }

  console.error('Passkey error', error)
  return res.status(500).json({ error: 'Something went wrong' })
}

export const passkeyController = {
  /**
   * Unauthenticated on purpose: the login page needs to know whether to offer the
   * button before anyone has a token. It reveals only whether a passkey exists,
   * never which one — the credential list stays behind auth.
   */
  async status(_req: Request, res: Response) {
    if (!passkeysEnabled) {
      return res.json({ configured: false, registered: false })
    }

    try {
      const passkeys = await passkeyService.list()
      return res.json({ configured: true, registered: passkeys.length > 0 })
    } catch (error) {
      return fail(res, error)
    }
  },

  async list(_req: Request, res: Response) {
    try {
      return res.json({ passkeys: await passkeyService.list() })
    } catch (error) {
      return fail(res, error)
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await passkeyService.remove(String(req.params.id))
      return res.status(204).send()
    } catch (error) {
      return fail(res, error)
    }
  },

  async registrationOptions(_req: Request, res: Response) {
    try {
      return res.json(await passkeyService.registrationOptions())
    } catch (error) {
      return fail(res, error)
    }
  },

  async verifyRegistration(req: Request, res: Response) {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid registration response' })

    try {
      const passkey = await passkeyService.verifyRegistration(
        parsed.data.response as never,
        parsed.data.name ?? ''
      )
      return res.json({ passkey })
    } catch (error) {
      return fail(res, error)
    }
  },

  async authenticationOptions(_req: Request, res: Response) {
    try {
      return res.json(await passkeyService.authenticationOptions())
    } catch (error) {
      return fail(res, error)
    }
  },

  async verifyAuthentication(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid authentication response' })

    try {
      const token = await passkeyService.verifyAuthentication(parsed.data.response as never)
      return res.json({ token })
    } catch (error) {
      return fail(res, error)
    }
  },
}
