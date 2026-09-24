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
  description: string | null
  payment_method: string
  transaction_date: string
  created_at: string
  updated_at: string
}

export interface CreateTransactionPayload {
  transaction_type: TransactionType
  amount: number | string
  category: string
  description?: string
  payment_method: string
  transaction_date?: string
}

export interface UpdateTransactionPayload {
  transaction_type?: TransactionType
  amount?: number | string
  category?: string
  description?: string
  payment_method?: string
  transaction_date?: string
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
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}
