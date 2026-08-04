import { metadataModel } from '../metadata/metadata.model.js'
import { expenseModel } from '../expense/expense.model.js'
import type { Expense, UpdateExpenseInput } from '../expense/expense.types.d.js'
import type { RecurringRule } from './recurring.types.d.js'

/** Matches the chunk size `renameCategory` uses for the same fan-out shape. */
const CHUNK_SIZE = 25

/**
 * Rules are stored in the `recurring` attribute of the META item, so every write is a
 * read-modify-write of the whole array through `metadataModel.patch`. `patch` only SETs
 * the keys it is given, so this can never clobber categories or currency settings.
 */
export const recurringModel = {
  async list(userId: string): Promise<RecurringRule[]> {
    const metadata = await metadataModel.get(userId)
    return metadata?.recurring ?? []
  },

  /** Inserts or replaces a rule by id, preserving the order of the rest. */
  async save(userId: string, rule: RecurringRule): Promise<RecurringRule> {
    const rules = await this.list(userId)
    const index = rules.findIndex((r) => r.id === rule.id)

    const next = index === -1 ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r))
    await metadataModel.patch(userId, { recurring: next })

    return rule
  },

  /** Writes several rules at once — catch-up advances every watermark in one call. */
  async saveAll(userId: string, rules: RecurringRule[]): Promise<void> {
    await metadataModel.patch(userId, { recurring: rules })
  },

  async remove(userId: string, ruleId: string): Promise<boolean> {
    const rules = await this.list(userId)
    const next = rules.filter((r) => r.id !== ruleId)
    if (next.length === rules.length) return false

    await metadataModel.patch(userId, { recurring: next })
    return true
  },

  /**
   * Every row a rule has generated, across all months. Brute-force over `getAll` — the
   * same approach `expenseModel.renameCategory` takes, and for the same reason: there is
   * no index on anything but the sort key, and this is a single-user app.
   */
  async itemsForRule(userId: string, ruleId: string): Promise<Expense[]> {
    const all = await expenseModel.getAll(userId)
    return all.filter((expense) => expense.recurringId === ruleId)
  },

  /** Applies the same patch to a set of rows, 25 requests in flight at a time. */
  async applyToItems(
    userId: string,
    items: Expense[],
    updates: UpdateExpenseInput
  ): Promise<number> {
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      await Promise.all(
        items
          .slice(i, i + CHUNK_SIZE)
          .map((item) => expenseModel.update(userId, item.date, item.id, updates))
      )
    }
    return items.length
  },

  async deleteItems(userId: string, items: Expense[]): Promise<number> {
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      await Promise.all(
        items.slice(i, i + CHUNK_SIZE).map((item) => expenseModel.delete(userId, item.date, item.id))
      )
    }
    return items.length
  },
}
