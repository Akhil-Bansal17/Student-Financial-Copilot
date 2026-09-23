export type TransactionType = 'income' | 'expense'

export interface User {
  id: number
  email: string
  full_name?: string | null
  is_active: boolean
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export type MoneySource =
  | 'Pocket Money'
  | 'Salary'
  | 'Freelance'
  | 'Scholarship'
  | 'Family Support'
  | 'Other'

export type FinancialFocus =
  | 'Track my spending'
  | 'Save more money'
  | 'Control unnecessary spending'
  | 'Understand where my money goes'
  | 'Plan for a specific goal'
  | 'Just keep things organized'

export interface FinancialProfile {
  id: number
  user_id: number
  starting_balance: number | string
  onboarding_completed: boolean
  money_sources: MoneySource[]
  financial_focus: FinancialFocus[]
  created_at: string
  updated_at: string
}

export interface FinancialProfileUpdatePayload {
  starting_balance?: number | string
  money_sources?: MoneySource[]
  financial_focus?: FinancialFocus[]
}

export interface OnboardingCompletePayload {
  starting_balance?: number | string
  money_sources?: MoneySource[]
  financial_focus?: FinancialFocus[]
}

export interface TransactionItem {
  id: string
  title: string
  amount: number
  type: TransactionType
  category: string
  date: string
}

export interface UpcomingExpense {
  id: string
  title: string
  amount: number
  dueDate: string
  category: string
}

export interface MoneyInsight {
  id: string
  message: string
  type: 'warning' | 'info' | 'positive'
  badgeText?: string
}

export interface FinancialSummary {
  safeToSpend: number
  statusNote: string
  availableBalance: number
  spentThisMonth: number
  savings: number
}

export interface HealthStatus {
  status: string
  environment: string
  version: string
}

export interface ApiErrorPayload {
  code: number
  message: string
  details?: unknown
}
