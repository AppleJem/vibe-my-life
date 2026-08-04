import { PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { Expense, CreateExpenseInput, UpdateExpenseInput } from './expense.types.d.js'

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
    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, unknown> = {}
    const expressionAttributeNames: Record<string, string> = {}

    if (updates.date !== undefined) {
      updateExpressions.push('#date = :date')
      expressionAttributeValues[':date'] = updates.date
      expressionAttributeNames['#date'] = 'date'
    }
    if (updates.amount !== undefined) {
      updateExpressions.push('#amount = :amount')
      expressionAttributeValues[':amount'] = updates.amount
      expressionAttributeNames['#amount'] = 'amount'
    }
    if (updates.category !== undefined) {
      updateExpressions.push('#category = :category')
      expressionAttributeValues[':category'] = updates.category
      expressionAttributeNames['#category'] = 'category'
    }
    if (updates.note !== undefined) {
      updateExpressions.push('#note = :note')
      expressionAttributeValues[':note'] = updates.note
      expressionAttributeNames['#note'] = 'note'
    }

    if (updateExpressions.length === 0) {
      const existing = await this.getById(userId, date, expenseId)
      if (!existing) throw new Error('Expense not found')
      return existing
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `EXPENSE#${date}#${expenseId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
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
