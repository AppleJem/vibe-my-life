import type { Expense, TransactionType } from '../types/expense'

/**
 * The one place that knows an absent `type` means expense. Every row written before
 * income shipped lacks the attribute, so nothing should compare `e.type` directly.
 */
export function typeOf(expense: Expense): TransactionType {
  return expense.type ?? 'expense'
}

export function isIncome(expense: Expense): boolean {
  return typeOf(expense) === 'income'
}

/**
 * Positive for income, negative for expense. Only ever for net figures — charts sum
 * magnitudes within one type, and mixing signs into a donut's denominator breaks the
 * percentages.
 */
export function signedAmount(expense: Expense): number {
  return isIncome(expense) ? expense.amount : -expense.amount
}

/** Sum of magnitudes. Feed it one type's rows. */
export function sumOf(expenses: Expense[]): number {
  return expenses.reduce((total, e) => total + e.amount, 0)
}

export function splitByType(expenses: Expense[]): {
  expenses: Expense[]
  income: Expense[]
} {
  const out: { expenses: Expense[]; income: Expense[] } = { expenses: [], income: [] }
  for (const e of expenses) {
    if (isIncome(e)) out.income.push(e)
    else out.expenses.push(e)
  }
  return out
}

/** Rows of one type only, preserving order. */
export function ofType(expenses: Expense[], type: TransactionType): Expense[] {
  return expenses.filter((e) => typeOf(e) === type)
}
