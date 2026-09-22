export type TransactionType = 'income' | 'expense'

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
