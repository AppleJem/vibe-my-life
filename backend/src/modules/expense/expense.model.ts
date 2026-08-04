import { PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { Expense, CreateExpenseInput, ImportExpenseInput, UpdateExpenseInput } from './expense.types.d.js'

/** DynamoDB's hard cap on items per BatchWriteItem call. */
const BATCH_SIZE = 25

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const expenseModel = {
  async create(userId: string, input: CreateExpenseInput): Promise<Expense> {
    const id = uuidv4()
    const now = new Date().toISOString()

    const expense: Expense = {
      id,
      date: input.date,
      amount: input.amount,
      category: input.category,
      note: input.note ?? '',
      createdAt: now,
      // Only spread the currency fields that were actually provided — DynamoDB
      // rejects explicit `undefined` attribute values.
      ...(input.baseCurrency !== undefined && { baseCurrency: input.baseCurrency }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.originalAmount !== undefined && { originalAmount: input.originalAmount }),
      ...(input.rate !== undefined && { rate: input.rate }),
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: `EXPENSE#${input.date}#${id}`,
        ...expense,
      },
    }))

    return expense
  },

  /**
   * Bulk-inserts expenses via BatchWriteItem, 25 at a time. Used by the backup
   * importer, where several hundred rows land at once and sequential puts would be
   * both slow and prone to leaving a half-written import behind.
   *
   * Unlike `create`, each input may supply its own `createdAt` so an imported row
   * keeps the timestamp it had in the source file.
   *
   * Returns the expenses written. Throws if a chunk still has unprocessed items
   * after the retries — the caller reports a partial import rather than claiming
   * success.
   */
  async createMany(userId: string, inputs: ImportExpenseInput[]): Promise<Expense[]> {
    const now = new Date().toISOString()

    const expenses: Expense[] = inputs.map((input) => ({
      id: uuidv4(),
      date: input.date,
      amount: input.amount,
      category: input.category,
      note: input.note ?? '',
      createdAt: input.createdAt ?? now,
      // Same conditional spreads as `create` — DynamoDB rejects explicit `undefined`,
      // and an absent `currency` is what marks a row as base-currency.
      ...(input.baseCurrency !== undefined && { baseCurrency: input.baseCurrency }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.originalAmount !== undefined && { originalAmount: input.originalAmount }),
      ...(input.rate !== undefined && { rate: input.rate }),
    }))

    for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
      let unprocessed = expenses.slice(i, i + BATCH_SIZE).map((expense) => ({
        PutRequest: {
          Item: {
            PK: `USER#${userId}`,
            SK: `EXPENSE#${expense.date}#${expense.id}`,
            ...expense,
          },
        },
      }))

      // Throughput throttling comes back as UnprocessedItems rather than an error,
      // so retry those with exponential backoff before giving up.
      for (let attempt = 0; unprocessed.length > 0 && attempt < 5; attempt++) {
        if (attempt > 0) await sleep(2 ** attempt * 50)

        const result = await docClient.send(new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: unprocessed },
        }))

        unprocessed = (result.UnprocessedItems?.[TABLE_NAME] ?? []) as typeof unprocessed
      }

      if (unprocessed.length > 0) {
        throw new Error(`Failed to write ${unprocessed.length} expenses after retries`)
      }
    }

    return expenses
  },

  async getByMonth(userId: string, yearMonth: string): Promise<Expense[]> {
    // yearMonth format: "2026-08"
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':start': `EXPENSE#${yearMonth}`,
        ':end': `EXPENSE#${yearMonth}~`,
      },
      ScanIndexForward: true, // chronological order
    }))

    return (result.Items ?? []) as Expense[]
  },

  async getAll(userId: string): Promise<Expense[]> {
    const items: Expense[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'EXPENSE#',
        },
        ExclusiveStartKey: lastKey,
      }))

      items.push(...((result.Items ?? []) as Expense[]))
      lastKey = result.LastEvaluatedKey
    } while (lastKey)

    return items
  },

  // Rewrites the category of every expense under `from`, including its subcategories
  // ("Food" also moves "Food#Drinks"). Returns how many items were changed.
  async renameCategory(userId: string, from: string, to: string): Promise<number> {
    const all = await this.getAll(userId)
    const affected = all.filter(
      (e) => e.category === from || e.category.startsWith(`${from}#`)
    )

    const CHUNK_SIZE = 25
    for (let i = 0; i < affected.length; i += CHUNK_SIZE) {
      await Promise.all(
        affected.slice(i, i + CHUNK_SIZE).map((expense) =>
          docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `USER#${userId}`,
              SK: `EXPENSE#${expense.date}#${expense.id}`,
            },
            UpdateExpression: 'SET #category = :category',
            ExpressionAttributeNames: { '#category': 'category' },
            ExpressionAttributeValues: {
              ':category': to + expense.category.slice(from.length),
            },
          }))
        )
      )
    }

    return affected.length
  },

  async getById(userId: string, date: string, expenseId: string): Promise<Expense | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `EXPENSE#${date}#${expenseId}`,
      },
    }))

    return (result.Item as Expense) ?? null
  },

  async update(userId: string, date: string, expenseId: string, updates: UpdateExpenseInput): Promise<Expense> {
    const UPDATABLE = [
      'date', 'amount', 'category', 'note',
      'baseCurrency', 'currency', 'originalAmount', 'rate',
    ] as const

    const setExpressions: string[] = []
    const removeExpressions: string[] = []
    const expressionAttributeValues: Record<string, unknown> = {}
    const expressionAttributeNames: Record<string, string> = {}

    for (const field of UPDATABLE) {
      const value = updates[field]
      if (value === undefined) continue

      expressionAttributeNames[`#${field}`] = field

      // An explicit null clears the attribute — a foreign-currency expense edited
      // back to the base currency has to shed currency/originalAmount/rate entirely.
      if (value === null) {
        removeExpressions.push(`#${field}`)
      } else {
        setExpressions.push(`#${field} = :${field}`)
        expressionAttributeValues[`:${field}`] = value
      }
    }

    if (setExpressions.length === 0 && removeExpressions.length === 0) {
      const existing = await this.getById(userId, date, expenseId)
      if (!existing) throw new Error('Expense not found')
      return existing
    }

    const clauses: string[] = []
    if (setExpressions.length > 0) clauses.push(`SET ${setExpressions.join(', ')}`)
    if (removeExpressions.length > 0) clauses.push(`REMOVE ${removeExpressions.join(', ')}`)

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `EXPENSE#${date}#${expenseId}`,
      },
      UpdateExpression: clauses.join(' '),
      ExpressionAttributeValues:
        Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    }))

    return result.Attributes as Expense
  },

  async delete(userId: string, date: string, expenseId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `EXPENSE#${date}#${expenseId}`,
      },
    }))
  },
}
