import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { env } from '../../config/env.js'
import { authService } from '../auth/auth.service.js'
import { passkeyModel } from './passkey.model.js'
import type { PasskeySummary, StoredPasskey } from './passkey.types.d.js'

/**
 * The app has exactly one account (see `authService`), so there is no lookup by
 * username anywhere here — every passkey belongs to `me`, and login is fully
 * discoverable: the browser offers whatever credential it holds for this RP and
 * the server identifies it after the fact by credential ID.
 */
const USER_ID = 'me'

/** Dynamo can hold binary, but base64url keeps the row plain JSON like every other. */
const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url')
const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const decoded = Buffer.from(value, 'base64url')
  // Copied into a freshly allocated ArrayBuffer rather than wrapping the Buffer:
  // Node pools small Buffers, so `decoded.buffer` is a shared arena, not just these
  // bytes — and the library's key parser expects a plain ArrayBuffer view.
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length))
  bytes.set(decoded)
  return bytes
}

/** Thrown for every expected failure; the controller maps it to a 4xx. */
export class PasskeyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const rpID = (): string => {
  if (!env.RP_ID || env.RP_ORIGIN.length === 0) {
    throw new PasskeyError('Passkeys are not configured on this server', 503)
  }
  return env.RP_ID
}

const toSummary = (passkey: StoredPasskey): PasskeySummary => ({
  id: passkey.id,
  name: passkey.name,
  backedUp: passkey.backedUp,
  createdAt: passkey.createdAt,
  lastUsedAt: passkey.lastUsedAt,
})

export const passkeyService = {
  async list(): Promise<PasskeySummary[]> {
    const passkeys = await passkeyModel.list(USER_ID)
    return passkeys
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toSummary)
  },

  async remove(credentialId: string): Promise<void> {
    const existing = await passkeyModel.get(USER_ID, credentialId)
    if (!existing) throw new PasskeyError('Passkey not found', 404)

    await passkeyModel.delete(USER_ID, credentialId)
  },

  async registrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const existing = await passkeyModel.list(USER_ID)

    const options = await generateRegistrationOptions({
      rpName: 'Vibe My Life',
      rpID: rpID(),
      userName: env.LOGIN_USERNAME,
      // Stable across registrations so a second device lands under the same account
      // in the passkey manager instead of showing up as a separate identity.
      userID: new TextEncoder().encode(USER_ID),
      attestationType: 'none',
      // Registering the same authenticator twice would leave a dead row that can
      // never be selected; the browser greys it out in the picker instead.
      excludeCredentials: existing.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        // Discoverable, so login needs no username typed first — the whole point.
        residentKey: 'required',
        // 'required' is what turns the prompt into Face ID / Touch ID rather than a
        // bare presence tap. Without it the credential proves possession, not identity.
        userVerification: 'required',
      },
    })

    await passkeyModel.saveChallenge(USER_ID, 'register', options.challenge)

    return options
  },

  async verifyRegistration(response: RegistrationResponseJSON, name: string): Promise<PasskeySummary> {
    const expectedChallenge = await passkeyModel.consumeChallenge(USER_ID, 'register')
    if (!expectedChallenge) {
      throw new PasskeyError('Registration challenge expired — please try again')
    }

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: env.RP_ORIGIN,
        expectedRPID: rpID(),
        requireUserVerification: true,
      })
    } catch (error) {
      throw new PasskeyError(error instanceof Error ? error.message : 'Registration failed')
    }

    if (!verification.verified) throw new PasskeyError('Registration could not be verified')

    const { credential, credentialBackedUp } = verification.registrationInfo

    const passkey: StoredPasskey = {
      id: credential.id,
      publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      name: name.trim() || 'Passkey',
      backedUp: credentialBackedUp,
      createdAt: new Date().toISOString(),
      lastUsedAt: '',
    }

    await passkeyModel.create(USER_ID, passkey)

    return toSummary(passkey)
  },

  async authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      // Deliberately no allowCredentials: the credentials are discoverable, so the
      // browser picks from what it holds. Sending the list would leak which passkeys
      // exist to anyone who can hit this unauthenticated endpoint.
      userVerification: 'required',
    })

    await passkeyModel.saveChallenge(USER_ID, 'login', options.challenge)

    return options
  },

  /** Returns the same JWT `authService` issues for a password login. */
  async verifyAuthentication(response: AuthenticationResponseJSON): Promise<string> {
    const expectedChallenge = await passkeyModel.consumeChallenge(USER_ID, 'login')
    if (!expectedChallenge) {
      throw new PasskeyError('Login challenge expired — please try again', 401)
    }

    const stored = await passkeyModel.get(USER_ID, response.id)
    if (!stored) throw new PasskeyError('Unrecognised passkey', 401)

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: env.RP_ORIGIN,
        expectedRPID: rpID(),
        credential: {
          id: stored.id,
          publicKey: fromBase64Url(stored.publicKey),
          counter: stored.counter,
          transports: stored.transports,
        },
        requireUserVerification: true,
      })
    } catch {
      throw new PasskeyError('Passkey verification failed', 401)
    }

    if (!verification.verified) throw new PasskeyError('Passkey verification failed', 401)

    await passkeyModel.recordUse(USER_ID, stored.id, verification.authenticationInfo.newCounter)

    return authService.issueToken('passkey')
  },
}
