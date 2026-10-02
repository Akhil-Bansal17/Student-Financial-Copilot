export type TransactionType = 'income' | 'expense'

export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Education'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Hostel/Rent'
  | 'Other'

export type IncomeCategory =
  | 'Pocket Money'
  | 'Salary'
  | 'Freelance'
  | 'Scholarship'
  | 'Family Support'
  | 'Other'

export type TransactionCategory = ExpenseCategory | IncomeCategory

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Debit Card'
  | 'Credit Card'
  | 'Bank Transfer'
  | 'Other'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Education',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Hostel/Rent',
  'Other',
]

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Pocket Money',
  'Salary',
  'Freelance',
  'Scholarship',
  'Family Support',
  'Other',
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
  'Other',
]

export interface Transaction {
  id: number
  user_id: number
  transaction_type: TransactionType
  amount: number | string
  category: string
  merchant?: string | null
  normalized_merchant?: string | null
  category_confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | string | null
  categorization_source?: string | null
  status?: 'POSTED' | 'PENDING' | 'REVERSED' | string
  description: string | null
  payment_method: string
  transaction_date: string
  source?: 'MANUAL' | 'BANK_SYNC' | 'RECONCILED'
  reconciliation_status?: string | null
  reconciled_with_id?: number | null
  provider?: string | null
  account_id?: number | null
  external_transaction_id?: string | null
  raw_bank_description?: string | null
  imported_at?: string | null
  is_recurring?: boolean | null
  recurring_type?: string | null
  created_at: string
  updated_at: string
}

export interface CreateTransactionPayload {
  transaction_type: TransactionType
  amount: number | string
  category: string
  merchant?: string
  description?: string
  payment_method: string
  transaction_date?: string
}

export interface UpdateTransactionPayload {
  transaction_type?: TransactionType
  amount?: number | string
  category?: string
  merchant?: string
  description?: string
  payment_method?: string
  transaction_date?: string
  remember_merchant_preference?: boolean
}

export interface BulkCategoryPayload {
  transaction_ids: number[]
  category: string
  update_merchant_preference?: boolean
}

export interface BulkCategoryResponse {
  updated_count: number
  category: string
  preference_saved: boolean
}

export interface MerchantPreference {
  id: number
  user_id: number
  normalized_merchant: string
  category: string
  created_at: string
  updated_at: string
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  limit: number
  offset: number
}

export interface FinancialSummaryResponse {
  starting_balance: number | string
  total_income: number | string
  total_expenses: number | string
  current_balance: number | string
  net_cash_flow?: number | string
  income_transaction_count?: number
  expense_transaction_count?: number
  currency: string
}

export interface TransactionFilters {
  transaction_type?: TransactionType
  category?: string
  search?: string
  merchant?: string
  source?: string
  account_id?: number
  start_date?: string
  end_date?: string
  min_amount?: number
  max_amount?: number
  reconciliation_status?: string
  limit?: number
  offset?: number
}
