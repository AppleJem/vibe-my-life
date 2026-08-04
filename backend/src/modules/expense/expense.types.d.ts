export interface Expense {
  id: string
  date: string          // YYYY-MM-DD
  amount: number
  category: string
  note: string
  createdAt: string     // ISO string
}

export interface CreateExpenseInput {
  date: string
  amount: number
  category: string
  note?: string
}

export interface UpdateExpenseInput {
  date?: string
  amount?: number
  category?: string
  note?: string
}
