export interface Category {
  name: string
  subcategories: string[]
}

export interface ExpenseMetadata {
  categories: Category[]
  updatedAt: string
}

export interface CategoryRename {
  from: string
  to: string
}
