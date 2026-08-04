import { parseCategory } from '../constants/categories'
import type { Expense } from '../types/expense'

export interface CategoryTotal {
  /** Parent category name, e.g. "🍜 Food" — subcategories are rolled up into it. */
  parent: string
  amount: number
  expenses: Expense[]
}

/**
 * Totals a month's expenses by parent category, biggest spend first.
 *
 * `expense.amount` is already normalised to the base currency, so foreign-currency
 * rows sum alongside the rest without conversion.
 */
export function categoryTotals(expenses: Expense[]): CategoryTotal[] {
  const byParent = new Map<string, CategoryTotal>()

  for (const expense of expenses) {
    const { parent } = parseCategory(expense.category)
    const entry = byParent.get(parent)

    if (entry) {
      entry.amount += expense.amount
      entry.expenses.push(expense)
    } else {
      byParent.set(parent, { parent, amount: expense.amount, expenses: [expense] })
    }
  }

  return [...byParent.values()].sort((a, b) => b.amount - a.amount)
}
