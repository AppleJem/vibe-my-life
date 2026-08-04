import axios from 'axios'
import type { Expense, CreateExpenseInput, UpdateExpenseInput } from '../types/expense'
import type { Category } from '../constants/categories'

export interface CategoryRename {
  from: string
  to: string
}

export interface ExpenseMetadata {
  categories: Category[]
  updatedAt: string
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  async login(username: string, password: string): Promise<string> {
    const { data } = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', data.token)
    return data.token
  },

  logout() {
    localStorage.removeItem('token')
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token')
  },
}

export const expenseApi = {
  async getExpenses(month: string): Promise<Expense[]> {
    const { data } = await api.get('/expenses', { params: { month } })
    return data.expenses
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const { data } = await api.post('/expenses', input)
    return data.expense
  },

  async updateExpense(id: string, date: string, updates: UpdateExpenseInput): Promise<Expense> {
    const { data } = await api.put(`/expenses/${id}`, updates, { params: { date } })
    return data.expense
  },

  async deleteExpense(id: string, date: string): Promise<void> {
    await api.delete(`/expenses/${id}`, { params: { date } })
  },
}

export const metadataApi = {
  async getMetadata(): Promise<ExpenseMetadata> {
    const { data } = await api.get('/metadata')
    return data.metadata
  },

  // Renames are applied retroactively to existing expenses by the backend,
  // across every month — deletions are deliberately not.
  async saveCategories(
    categories: Category[],
    renames: CategoryRename[] = []
  ): Promise<ExpenseMetadata> {
    const { data } = await api.put('/metadata/categories', { categories, renames })
    return data.metadata
  },
}
