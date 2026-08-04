import axios from 'axios'
import type {
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  TransactionType,
} from '../types/expense'
import type { Category } from '../constants/categories'

export interface CategoryRename {
  from: string
  to: string
}

/** Both lists are saved together so one page can't leave the other stale. */
export interface SaveCategoriesPayload {
  categories: Category[]
  renames: CategoryRename[]
  incomeCategories: Category[]
  incomeRenames: CategoryRename[]
}

export interface ExpenseMetadata {
  categories: Category[]
  /** Independent of `categories` — names may overlap between the two lists. */
  incomeCategories: Category[]
  baseCurrency: string
  /** Additional currencies; never includes baseCurrency. */
  currencies: string[]
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

/**
 * Where one (kind, category, subcategory) triple from a backup file should land.
 * `kind` is part of the identity — the same source name can appear on both income
 * and expense rows and maps into the respective list.
 */
export interface CategoryMapping {
  kind: TransactionType
  sourceCategory: string
  sourceSubcategory: string | null
  parent: string
  sub: string | null
}

export interface MappingSuggestion extends CategoryMapping {
  count: number
  parentIsNew: boolean
  subIsNew: boolean
}

export interface ImportPreview {
  baseCurrency: string
  totals: {
    rows: number
    /** Expense + income rows that will be written. */
    importable: number
    importableIncome: number
    skippedTransfer: number
    skippedInvalid: number
  }
  zeroAmountRows: number
  dateRange: { from: string; to: string } | null
  currencies: string[]
  accountsDropped: string[]
  duplicatesFound: number
  mappings: MappingSuggestion[]
  warnings: string[]
}

export interface ImportResult {
  imported: number
  /** Subset of `imported` that landed as income. */
  importedIncome: number
  skippedTransfer: number
  skippedInvalid: number
  skippedDuplicate: number
  categoriesCreated: string[]
  incomeCategoriesCreated: string[]
}

export const importApi = {
  /** Parses a backup and returns what would happen. Writes nothing. */
  async analyze(file: File): Promise<ImportPreview> {
    const form = new FormData()
    form.append('file', file)
    // No explicit Content-Type — the browser sets it with the multipart boundary.
    const { data } = await api.post('/import/analyze', form)
    return data
  },

  /** Sends the file a second time so the server, not the client, does the parsing. */
  async commit(file: File, mappings: CategoryMapping[]): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)
    form.append('mapping', JSON.stringify({ mappings }))
    const { data } = await api.post('/import/commit', form)
    return data
  },
}

export const metadataApi = {
  async getMetadata(): Promise<ExpenseMetadata> {
    const { data } = await api.get('/metadata')
    return data.metadata
  },

  // Renames are applied retroactively to existing rows by the backend, across every
  // month and scoped to their own type — deletions are deliberately not.
  async saveCategories(payload: SaveCategoriesPayload): Promise<ExpenseMetadata> {
    const { data } = await api.put('/metadata/categories', payload)
    return data.metadata
  },

  async saveCurrency(baseCurrency: string, currencies: string[]): Promise<ExpenseMetadata> {
    const { data } = await api.put('/metadata/currency', { baseCurrency, currencies })
    return data.metadata
  },
}
