import { PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { ChallengeKind, StoredPasskey } from './passkey.types.d.js'

/**
 * Passkeys share the expense table under their own `PASSKEY#` sort-key prefix, the way
 * holdings use `HOLDING#` — no new table, and they stay invisible to every existing
 * query. The credential ID is already unique and URL-safe, so it is the key suffix.
 */
const passkeyKey = (userId: string, credentialId: string) => ({
  PK: `USER#${userId}`,
  SK: `PASSKEY#${credentialId}`,
})

/**
 * The challenge from `generate*Options` has to survive until the browser posts its
 * response back, which means it cannot live in process memory: the login half runs
 * before any token exists, and a restart or a second instance would strand it. One
 * row per kind, overwritten on each attempt, so a new prompt invalidates the old one.
 */
const challengeKey = (userId: string, kind: ChallengeKind) => ({
  PK: `USER#${userId}`,
  SK: `PASSKEY_CHALLENGE#${kind}`,
})

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export const passkeyModel = {
  async list(userId: string): Promise<StoredPasskey[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'PASSKEY#',
      },
    }))

    // The challenge rows sort under `PASSKEY_CHALLENGE#`, which the `PASSKEY#` prefix
    // does not match ('_' vs '#' at the eighth character), so they stay out of this
    // query. The id check is only a guard against a future sibling prefix.
    return ((result.Items ?? []) as StoredPasskey[]).filter((item) => Boolean(item.id))
  },

  async get(userId: string, credentialId: string): Promise<StoredPasskey | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: passkeyKey(userId, credentialId),
    }))

    return (result.Item as StoredPasskey | undefined) ?? null
  },

  async create(userId: string, passkey: StoredPasskey): Promise<StoredPasskey> {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...passkeyKey(userId, passkey.id), ...passkey },
    }))

    return passkey
  },

  async delete(userId: string, credentialId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: passkeyKey(userId, credentialId),
    }))
  },

  /**
   * Written after every successful assertion. The counter is the replay defence for
   * authenticators that maintain one; `lastUsedAt` is only for the settings list.
   */
  async recordUse(userId: string, credentialId: string, counter: number): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: passkeyKey(userId, credentialId),
      UpdateExpression: 'SET #counter = :counter, #lastUsedAt = :lastUsedAt',
      ExpressionAttributeNames: { '#counter': 'counter', '#lastUsedAt': 'lastUsedAt' },
      ExpressionAttributeValues: {
        ':counter': counter,
        ':lastUsedAt': new Date().toISOString(),
      },
    }))
  },

  async saveChallenge(userId: string, kind: ChallengeKind, challenge: string): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...challengeKey(userId, kind),
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
      },
    }))
  },

  /**
   * Reads and immediately deletes: a challenge is single-use, and deleting before the
   * caller verifies means a failed attempt can't be retried against the same value.
   * Returns null once expired, so a prompt left open overnight can't be completed.
   */
  async consumeChallenge(userId: string, kind: ChallengeKind): Promise<string | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: challengeKey(userId, kind),
      ConsistentRead: true,
    }))

    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: challengeKey(userId, kind),
    }))

    if (!result.Item) return null
    if (typeof result.Item.expiresAt === 'number' && result.Item.expiresAt < Date.now()) return null

    return (result.Item.challenge as string | undefined) ?? null
  },
}
