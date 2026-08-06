import {
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, HABIT_TABLE_NAME } from '../../config/db.js'
import type {
  Habit,
  CreateHabitInput,
  UpdateHabitInput,
  Completion,
  CreateCompletionInput,
  HabitGroup,
  CreateHabitGroupInput,
  UpdateHabitGroupInput,
} from './habit.types.d.js'

/** DynamoDB's hard cap on items per BatchWriteItem call. */
const BATCH_SIZE = 25

/** Pink — the first swatch the form offers. */
const DEFAULT_COLOR = '#ec4899'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const habitKey = (userId: string, habitId: string) => ({
  PK: `USER#${userId}`,
  SK: `META#${habitId}`,
})

const groupKey = (userId: string, groupId: string) => ({
  PK: `USER#${userId}`,
  SK: `HABIT_GROUP#${groupId}`,
})

const completionKey = (userId: string, habitId: string, timestamp: string) => ({
  PK: `USER#${userId}`,
  SK: `HABIT#${habitId}#COMPLETION#${timestamp}`,
})

/** Every completion of one habit shares this sort-key prefix. */
const completionPrefix = (habitId: string) => `HABIT#${habitId}#COMPLETION#`

interface PrefixFilter {
  expression: string
  names: Record<string, string>
  values: Record<string, unknown>
}

/**
 * Pages a `begins_with` query to exhaustion, optionally narrowing rows with a
 * FilterExpression. The sort key can't be range-sliced by day: it carries a UTC
 * timestamp, and comparing that against locally-dated rows is off-by-a-day-prone. Any
 * date bound therefore has to be a filter on the `date` attribute instead.
 */
async function queryByPrefix<T>(
  userId: string,
  prefix: string,
  filter?: PrefixFilter
): Promise<T[]> {
  const items: T[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: HABIT_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': prefix,
        ...filter?.values,
      },
      ...(filter && {
        FilterExpression: filter.expression,
        ExpressionAttributeNames: filter.names,
      }),
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    }))

    items.push(...((result.Items ?? []) as T[]))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

/**
 * Appends a habit to a group's order in one atomic write — no read first, so two habits
 * created at once can't clobber each other's append.
 */
async function appendToGroup(userId: string, groupId: string, habitId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: HABIT_TABLE_NAME,
    Key: groupKey(userId, groupId),
    UpdateExpression: 'SET #habitIds = list_append(if_not_exists(#habitIds, :empty), :one)',
    ExpressionAttributeNames: { '#habitIds': 'habitIds' },
    ExpressionAttributeValues: { ':empty': [], ':one': [habitId] },
    // A group that has since been deleted just means there is no order to record. The
    // habit's own `groupId` is what membership is read from, so nothing is lost.
    ConditionExpression: 'attribute_exists(SK)',
  })).catch((err: unknown) => {
    if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err
  })
}

/**
 * Drops a habit from a group's order. Read-modify-write, because removal needs the index —
 * and unlike the append, a lost update here only leaves a stale id, which the reader
 * already ignores.
 */
async function removeFromGroup(userId: string, groupId: string, habitId: string): Promise<void> {
  const group = await habitGroupModel.getGroup(userId, groupId)
  if (!group || !group.habitIds.includes(habitId)) return

  await docClient.send(new UpdateCommand({
    TableName: HABIT_TABLE_NAME,
    Key: groupKey(userId, groupId),
    UpdateExpression: 'SET #habitIds = :habitIds',
    ExpressionAttributeNames: { '#habitIds': 'habitIds' },
    ExpressionAttributeValues: {
      ':habitIds': group.habitIds.filter((id) => id !== habitId),
    },
  }))
}

export const habitModel = {
  async listHabits(userId: string): Promise<Habit[]> {
    return queryByPrefix<Habit>(userId, 'META#')
  },

  async getHabit(userId: string, habitId: string): Promise<Habit | null> {
    const result = await docClient.send(new GetCommand({
      TableName: HABIT_TABLE_NAME,
      Key: habitKey(userId, habitId),
    }))

    return (result.Item as Habit) ?? null
  },

  async createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
    const habit: Habit = {
      id: uuidv4(),
      name: input.name,
      emoji: input.emoji,
      description: input.description ?? '',
      type: input.type,
      tags: input.tags ?? [],
      color: input.color ?? DEFAULT_COLOR,
      createdAt: new Date().toISOString(),
      // Only spread what was actually provided — DynamoDB rejects explicit `undefined`,
      // and an absent `unit` is what marks a habit as unitless.
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.target !== undefined && { target: input.target }),
      // A null group means ungrouped — leave the attribute off entirely rather than
      // storing an empty one.
      ...(input.groupId != null && { groupId: input.groupId }),
    }

    await docClient.send(new PutCommand({
      TableName: HABIT_TABLE_NAME,
      Item: { ...habitKey(userId, habit.id), ...habit },
    }))

    // Recorded after the habit exists: an order entry pointing at nothing would be the
    // worse failure, and the reader drops ids it can't resolve anyway.
    if (habit.groupId) await appendToGroup(userId, habit.groupId, habit.id)

    return habit
  },

  async updateHabit(userId: string, habitId: string, updates: UpdateHabitInput): Promise<Habit> {
    const UPDATABLE = [
      'name', 'emoji', 'type', 'description', 'unit', 'target', 'tags', 'groupId', 'color', 'archived',
    ] as const

    const setExpressions: string[] = []
    const removeExpressions: string[] = []
    const expressionAttributeValues: Record<string, unknown> = {}
    const expressionAttributeNames: Record<string, string> = {}

    for (const field of UPDATABLE) {
      const value = updates[field]
      if (value === undefined) continue

      expressionAttributeNames[`#${field}`] = field

      // An explicit null clears the attribute — switching a count habit to boolean has
      // to shed `unit` and `target` entirely rather than leave them stale.
      if (value === null) {
        removeExpressions.push(`#${field}`)
      } else {
        setExpressions.push(`#${field} = :${field}`)
        expressionAttributeValues[`:${field}`] = value
      }
    }

    // Read before writing, so a group move knows which group to splice the habit out of.
    // Only when `groupId` is actually part of the update — every other field is blind.
    const previous = updates.groupId !== undefined ? await this.getHabit(userId, habitId) : null

    if (setExpressions.length === 0 && removeExpressions.length === 0) {
      const existing = previous ?? await this.getHabit(userId, habitId)
      if (!existing) throw new Error('Habit not found')
      return existing
    }

    const clauses: string[] = []
    if (setExpressions.length > 0) clauses.push(`SET ${setExpressions.join(', ')}`)
    if (removeExpressions.length > 0) clauses.push(`REMOVE ${removeExpressions.join(', ')}`)

    const result = await docClient.send(new UpdateCommand({
      TableName: HABIT_TABLE_NAME,
      Key: habitKey(userId, habitId),
      UpdateExpression: clauses.join(' '),
      ExpressionAttributeValues:
        Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    }))

    const habit = result.Attributes as Habit

    if (previous && previous.groupId !== habit.groupId) {
      if (previous.groupId) await removeFromGroup(userId, previous.groupId, habitId)
      if (habit.groupId) await appendToGroup(userId, habit.groupId, habitId)
    }

    return habit
  },

  /**
   * Deletes the definition and every completion under it. History is deleted *after*
   * the definition would still be recoverable, so a failure mid-way leaves orphaned
   * completions rather than a habit whose history has silently vanished — and the
   * definition goes last, so a retry of the same delete finishes the job.
   */
  async deleteHabit(userId: string, habitId: string): Promise<void> {
    const habit = await this.getHabit(userId, habitId)
    const completions = await this.listCompletions(userId, habitId)

    for (let i = 0; i < completions.length; i += BATCH_SIZE) {
      let unprocessed = completions.slice(i, i + BATCH_SIZE).map((completion) => ({
        DeleteRequest: { Key: completionKey(userId, habitId, completion.timestamp) },
      }))

      // Throughput throttling comes back as UnprocessedItems rather than an error,
      // so retry those with exponential backoff before giving up.
      for (let attempt = 0; unprocessed.length > 0 && attempt < 5; attempt++) {
        if (attempt > 0) await sleep(2 ** attempt * 50)

        const result = await docClient.send(new BatchWriteCommand({
          RequestItems: { [HABIT_TABLE_NAME]: unprocessed },
        }))

        unprocessed = (result.UnprocessedItems?.[HABIT_TABLE_NAME] ?? []) as typeof unprocessed
      }

      if (unprocessed.length > 0) {
        throw new Error(`Failed to delete ${unprocessed.length} completions after retries`)
      }
    }

    await docClient.send(new DeleteCommand({
      TableName: HABIT_TABLE_NAME,
      Key: habitKey(userId, habitId),
    }))

    if (habit?.groupId) await removeFromGroup(userId, habit.groupId, habitId)
  },

  /** Chronological, oldest first — the sort key carries the timestamp. */
  async listCompletions(userId: string, habitId: string): Promise<Completion[]> {
    return queryByPrefix<Completion>(userId, completionPrefix(habitId))
  },

  /**
   * Every habit's completions on or after `since` (a local `YYYY-MM-DD`), so the list
   * page can draw a week of history for the whole list in one round trip instead of one
   * per habit. `HABIT#` is the prefix all completions share, whichever habit they belong
   * to; definitions sit under `META#` and groups under `HABIT_GROUP#` — note that the
   * latter is *not* matched, since the sixth character is `_` rather than `#`. Any new
   * sort-key prefix has to keep clear of this sweep the same way.
   *
   * The bound is a filter on `date` — the client's own local day — rather than a sort-key
   * range on the UTC timestamp, which would file a late-evening log under the wrong day.
   * `date` is a DynamoDB reserved word, hence the `#date` alias.
   */
  async listRecentCompletions(userId: string, since: string): Promise<Completion[]> {
    return queryByPrefix<Completion>(userId, 'HABIT#', {
      expression: '#date >= :since',
      names: { '#date': 'date' },
      values: { ':since': since },
    })
  },

  async createCompletion(
    userId: string,
    habitId: string,
    input: CreateCompletionInput,
    unit?: string
  ): Promise<Completion> {
    const completion: Completion = {
      habitId,
      timestamp: new Date().toISOString(),
      date: input.date,
      notes: input.notes ?? '',
      ...(input.count !== undefined && { count: input.count }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      // Snapshotted so renaming the habit's unit later doesn't rewrite history.
      ...(unit !== undefined && { unit }),
    }

    await docClient.send(new PutCommand({
      TableName: HABIT_TABLE_NAME,
      Item: { ...completionKey(userId, habitId, completion.timestamp), ...completion },
    }))

    return completion
  },

  async deleteCompletion(userId: string, habitId: string, timestamp: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: HABIT_TABLE_NAME,
      Key: completionKey(userId, habitId, timestamp),
    }))
  },

  /**
   * Moves the denormalised `lastCompletedDate` on the definition. `null` removes it,
   * which is what a habit whose only completion was just deleted needs.
   */
  async touchLastCompleted(
    userId: string,
    habitId: string,
    date: string | null
  ): Promise<Habit> {
    const result = await docClient.send(new UpdateCommand({
      TableName: HABIT_TABLE_NAME,
      Key: habitKey(userId, habitId),
      UpdateExpression: date === null
        ? 'REMOVE #lastCompletedDate'
        : 'SET #lastCompletedDate = :date',
      ExpressionAttributeNames: { '#lastCompletedDate': 'lastCompletedDate' },
      ...(date !== null && { ExpressionAttributeValues: { ':date': date } }),
      ReturnValues: 'ALL_NEW',
    }))

    return result.Attributes as Habit
  },
}

export const habitGroupModel = {
  async listGroups(userId: string): Promise<HabitGroup[]> {
    return queryByPrefix<HabitGroup>(userId, 'HABIT_GROUP#')
  },

  async getGroup(userId: string, groupId: string): Promise<HabitGroup | null> {
    const result = await docClient.send(new GetCommand({
      TableName: HABIT_TABLE_NAME,
      Key: groupKey(userId, groupId),
    }))

    return (result.Item as HabitGroup) ?? null
  },

  async createGroup(userId: string, input: CreateHabitGroupInput): Promise<HabitGroup> {
    const group: HabitGroup = {
      id: uuidv4(),
      name: input.name,
      habitIds: [],
      createdAt: new Date().toISOString(),
    }

    await docClient.send(new PutCommand({
      TableName: HABIT_TABLE_NAME,
      Item: { ...groupKey(userId, group.id), ...group },
    }))

    return group
  },

  async updateGroup(
    userId: string,
    groupId: string,
    updates: UpdateHabitGroupInput
  ): Promise<HabitGroup> {
    const UPDATABLE = ['name', 'habitIds'] as const

    const setExpressions: string[] = []
    const expressionAttributeValues: Record<string, unknown> = {}
    const expressionAttributeNames: Record<string, string> = {}

    for (const field of UPDATABLE) {
      const value = updates[field]
      if (value === undefined) continue

      expressionAttributeNames[`#${field}`] = field
      setExpressions.push(`#${field} = :${field}`)
      expressionAttributeValues[`:${field}`] = value
    }

    if (setExpressions.length === 0) {
      const existing = await this.getGroup(userId, groupId)
      if (!existing) throw new Error('Group not found')
      return existing
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: HABIT_TABLE_NAME,
      Key: groupKey(userId, groupId),
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    }))

    return result.Attributes as HabitGroup
  },

  /**
   * Deleting a group keeps its habits — they fall back to ungrouped. The members are
   * released *before* the group row goes, so a failure part-way leaves habits pointing at
   * a group that still exists rather than at one that doesn't.
   */
  async deleteGroup(userId: string, groupId: string): Promise<void> {
    const habits = await habitModel.listHabits(userId)

    for (const habit of habits) {
      if (habit.groupId !== groupId) continue

      await docClient.send(new UpdateCommand({
        TableName: HABIT_TABLE_NAME,
        Key: habitKey(userId, habit.id),
        UpdateExpression: 'REMOVE #groupId',
        ExpressionAttributeNames: { '#groupId': 'groupId' },
      }))
    }

    await docClient.send(new DeleteCommand({
      TableName: HABIT_TABLE_NAME,
      Key: groupKey(userId, groupId),
    }))
  },
}
