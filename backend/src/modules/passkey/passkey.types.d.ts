/** A registered credential, as stored. Binary fields are base64url strings. */
export interface StoredPasskey {
  /** Credential ID, base64url. Unique per credential; doubles as the SK suffix. */
  id: string
  /** COSE public key, base64url-encoded for JSON/Dynamo storage. */
  publicKey: string
  /**
   * Authenticator's usage counter. Some authenticators (Apple's included) always
   * report 0, so this only detects cloning on the ones that do maintain it.
   */
  counter: number
  /** Transport hints returned at registration; replayed to speed up the prompt. */
  transports?: string[]
  /** Free-text label so a device can be told apart in settings. */
  name: string
  /** True when the credential syncs via a passkey provider (iCloud Keychain). */
  backedUp: boolean
  createdAt: string
  /** ISO timestamp of the last successful assertion, or '' if never used. */
  lastUsedAt: string
}

/** What the frontend is allowed to see — never the public key. */
export interface PasskeySummary {
  id: string
  name: string
  backedUp: boolean
  createdAt: string
  lastUsedAt: string
}

export type ChallengeKind = 'register' | 'login'
