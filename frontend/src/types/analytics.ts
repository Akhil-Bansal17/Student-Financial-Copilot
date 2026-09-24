export interface FinancialSummaryResponse {
  starting_balance: string
  current_balance: string
  total_income: string
  total_expenses: string
  net_cash_flow: string
  income_transaction_count: number
  expense_transaction_count: number
  currency: string
}

export interface MonthlyAnalyticsResponse {
  year: number
  month: number
  monthly_income: string
  monthly_expenses: string
  monthly_net_cash_flow: string
  transaction_count: number
  previous_month_income: string
  previous_month_expenses: string
  previous_month_net_cash_flow: string
  income_change_percentage: string | null
  expense_change_percentage: string | null
  net_cash_flow_change_percentage: string | null
}

export interface CategorySpendingItem {
  category: string
  amount: string
  percentage: string
  transaction_count: number
}

export interface CategorySpendingResponse {
  year: number
  month: number
  total_expenses: string
  items: CategorySpendingItem[]
}

export interface IncomeCategoryItem {
  category: string
  amount: string
  percentage: string
  transaction_count: number
}

export interface IncomeCategoryResponse {
  year: number
  month: number
  total_income: string
  items: IncomeCategoryItem[]
}

export interface DailyTrendItem {
  date: string
  income: string
  expenses: string
  net: string
}

export interface DailyTrendResponse {
  year: number
  month: number
  days: DailyTrendItem[]
}

export interface MonthFilterParams {
  year?: number
  month?: number
}
