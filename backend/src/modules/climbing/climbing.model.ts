import {
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, CLIMBING_TABLE_NAME } from '../../config/db.js'
import type { ClimbingSession, SessionInput } from './climbing.types.d.js'

const sessionKey = (userId: string, sessionId: string) => ({
  PK: `USER#${userId}`,
  SK: `SESSION#${sessionId}`,
})

/** Pages a `begins_with` query to exhaustion. */
async function queryByPrefix<T>(userId: string, prefix: string): Promise<T[]> {
  const items: T[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: CLIMBING_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': prefix },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    }))

    items.push(...((result.Items ?? []) as T[]))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

/**
 * Normalises the whole nested shape on the way in: ids assigned where they're missing,
 * absent optionals left off the item entirely rather than stored as `undefined` — which
 * DynamoDB rejects outright.
 *
 * A blank grade or description is treated as absent rather than stored as "", so a climb
 * the user started typing into and then cleared reads the same as one they never touched.
 */
function toStored(input: SessionInput): Omit<ClimbingSession, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    date: input.date,
    location: input.location.trim(),
    gradeSystem: input.gradeSystem.trim(),
    gradeKind: input.gradeKind,
    climbs: input.climbs.map((climb) => {
      const grade = climb.grade?.trim()
      const description = climb.description?.trim()
      const media = climb.media?.map((item) => ({
        id: item.id ?? uuidv4(),
        key: item.key,
        kind: item.kind,
        contentType: item.contentType,
        ...(item.posterKey !== undefined && { posterKey: item.posterKey }),
      }))

      return {
        id: climb.id ?? uuidv4(),
        // Conditional spread, not `outcome: climb.outcome`: DynamoDB rejects a literal
        // `undefined` attribute, so a nameless climb has to omit the key entirely.
        ...(climb.outcome && { outcome: climb.outcome }),
        ...(grade && { grade }),
        ...(description && { description }),
        ...(media && media.length > 0 && { media }),
      }
    }),
  }
}

export const climbingModel = {
  /** Every session, whole. They are small, and the list page shows more than a date. */
  async listSessions(userId: string): Promise<ClimbingSession[]> {
    return queryByPrefix<ClimbingSession>(userId, 'SESSION#')
  },

  async getSession(userId: string, sessionId: string): Promise<ClimbingSession | null> {
    const result = await docClient.send(new GetCommand({
      TableName: CLIMBING_TABLE_NAME,
      Key: sessionKey(userId, sessionId),
    }))

    return (result.Item as ClimbingSession) ?? null
  },

  async createSession(userId: string, input: SessionInput): Promise<ClimbingSession> {
    const now = new Date().toISOString()
    const session: ClimbingSession = {
      id: uuidv4(),
      ...toStored(input),
      createdAt: now,
      updatedAt: now,
    }

    await docClient.send(new PutCommand({
      TableName: CLIMBING_TABLE_NAME,
      Item: { ...sessionKey(userId, session.id), ...session },
    }))

    return session
  },

  /**
   * Replaces the session wholesale, keeping its id and `createdAt`. One `Put` rather than a
   * field-by-field `Update`: climbs are a list whose order *is* their meaning, so every save
   * that touches one is already sending the whole thing.
   *
   * Returns null when the session is gone, so editing something deleted on another device
   * 404s instead of resurrecting it.
   */
  async updateSession(
    userId: string,
    sessionId: string,
    input: SessionInput
  ): Promise<ClimbingSession | null> {
    const existing = await this.getSession(userId, sessionId)
    if (!existing) return null

    const session: ClimbingSession = {
      id: existing.id,
      ...toStored(input),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    try {
      await docClient.send(new PutCommand({
        TableName: CLIMBING_TABLE_NAME,
        Item: { ...sessionKey(userId, sessionId), ...session },
        // The read above is not a lock; this is what makes the write a true update even if
        // the session was deleted in between.
        ConditionExpression: 'attribute_exists(SK)',
      }))
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null
      throw err
    }

    return session
  },

  /**
   * One item, so nothing cascades in the table. The S3 objects the session referenced are
   * deleted by the caller, which is the only layer that knows whether the delete succeeded.
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: CLIMBING_TABLE_NAME,
      Key: sessionKey(userId, sessionId),
    }))
  },
}
