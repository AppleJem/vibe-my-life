import axios from 'axios'
import type {
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  TransactionType,
  RecurringRule,
  RecurringRuleInput,
  PropagateScope,
} from '../types/expense'
import type {
  Habit,
  CreateHabitInput,
  UpdateHabitInput,
  Completion,
  CreateCompletionInput,
} from '../types/habit'
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

/** Rows a recurring call wrote or rewrote, so the caller knows which months went stale. */
export interface RecurringWriteResult {
  rule: RecurringRule
  months: string[]
}

/**
 * Every call carries the client's **local** today. The server is UTC and must not be the
 * one deciding when a day rolls over, or a subscription fires early in Asia and late in
 * the Americas.
 */
export const recurringApi = {
  async list(): Promise<RecurringRule[]> {
    const { data } = await api.get('/recurring')
    return data.rules
  },

  /** Creates the rule and materialises anything already due, including the first row. */
  async create(
    input: RecurringRuleInput,
    today: string
  ): Promise<RecurringWriteResult & { created: Expense[] }> {
    const { data } = await api.post('/recurring', { ...input, today })
    return data
  },

  /** Catch-up: writes every occurrence owed since each rule last fired. */
  async run(today: string): Promise<{ created: Expense[]; months: string[] }> {
    const { data } = await api.post('/recurring/run', { today })
    return data
  },

  /**
   * `propagate` decides how far the change reaches into existing rows; `from` is the
   * occurrence date the "future" window opens at, defaulting to today.
   */
  async update(
    id: string,
    input: RecurringRuleInput,
    options: { propagate: PropagateScope; from?: string; today: string }
  ): Promise<RecurringWriteResult & { updatedCount: number }> {
    const { data } = await api.put(`/recurring/${id}`, { ...input, ...options })
    return data
  },

  /** `deleteItems` false detaches the generated rows instead of removing them. */
  async remove(
    id: string,
    deleteItems: boolean
  ): Promise<{ deleted: number; detached: number; months: string[] }> {
    const { data } = await api.delete(`/recurring/${id}`, { params: { deleteItems } })
    return data
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

/**
 * Habits are a separate life app — separate table, separate module, nothing shared with
 * expenses but the axios instance and the token.
 *
 * Every completion carries the client's **local** date for the same reason the recurring
 * calls carry `today`: the server is UTC and must not decide when a day rolls over.
 */
export const habitApi = {
  async list(): Promise<Habit[]> {
    const { data } = await api.get('/habits')
    return data.habits
  },

  async get(id: string): Promise<Habit> {
    const { data } = await api.get(`/habits/${id}`)
    return data.habit
  },

  async create(input: CreateHabitInput): Promise<Habit> {
    const { data } = await api.post('/habits', input)
    return data.habit
  },

  async update(id: string, input: UpdateHabitInput): Promise<Habit> {
    const { data } = await api.put(`/habits/${id}`, input)
    return data.habit
  },

  /** Cascades — the habit's whole history goes with it. */
  async remove(id: string): Promise<void> {
    await api.delete(`/habits/${id}`)
  },

  async completions(habitId: string): Promise<Completion[]> {
    const { data } = await api.get(`/habits/${habitId}/completions`)
    return data.completions
  },

  /**
   * Returns the updated habit alongside the completion so the list cache can be
   * refreshed without a second round trip — `lastCompletedDate` has just moved.
   *
   * Rejects with a 409 if the day is already logged; the caller surfaces that rather
   * than treating it as a generic failure.
   */
  async log(
    habitId: string,
    input: CreateCompletionInput
  ): Promise<{ completion: Completion; habit: Habit }> {
    const { data } = await api.post(`/habits/${habitId}/completions`, input)
    return data
  },

  /** The timestamp is an ISO string, so it has to be escaped into the path. */
  async unlog(habitId: string, timestamp: string): Promise<Habit> {
    const { data } = await api.delete(
      `/habits/${habitId}/completions/${encodeURIComponent(timestamp)}`
    )
    return data.habit
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

export interface ParsedExpenseItem {
  date: string
  amount: number
  type: 'expense' | 'income'
  category: string
  note: string
}

export const screenshotApi = {
  async parseScreenshots(files: File[], signal?: AbortSignal): Promise<ParsedExpenseItem[]> {
    const form = new FormData()
    files.forEach((file) => form.append('images', file))
    const { data } = await api.post('/screenshot/parse', form, { signal })
    return data.items
  },

  async batchCreateExpenses(items: CreateExpenseInput[]): Promise<Expense[]> {
    const { data } = await api.post('/expenses/batch', { items })
    return data.expenses
  },
}

export interface VoiceParseResult {
  transcript: string
  items: ParsedExpenseItem[]
}

export interface VoiceCategory {
  name: string
  subcategories: string[]
}

export const voiceApi = {
  async parseVoiceRecording(
    audioBlob: Blob,
    categories: VoiceCategory[],
    incomeCategories: VoiceCategory[],
    signal?: AbortSignal
  ): Promise<VoiceParseResult> {
    const form = new FormData()
    // Determine file extension from blob type
    const ext = audioBlob.type.includes('ogg') ? 'ogg' : 
                audioBlob.type.includes('mp4') ? 'mp4' : 
                audioBlob.type.includes('wav') ? 'wav' : 'webm'
    form.append('audio', audioBlob, `recording.${ext}`)
    form.append('categories', JSON.stringify(categories))
    form.append('incomeCategories', JSON.stringify(incomeCategories))
    const { data } = await api.post('/voice/parse', form, { signal })
    return data
  },
}
