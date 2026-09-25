export interface Budget {
  id: number
  user_id: number
  year: number
  month: number
  category: string | null
  amount: string
  created_at: string
  updated_at: string
  actual_spending: string
  remaining: string
  utilization_percentage: string
  over_budget: boolean
}

export interface OverallBudgetSummary {
  id: number
  budget: string
  spent: string
  remaining: string
  utilization: string
  over_budget: boolean
}

export interface BudgetCategorySummary {
  id: number
  category: string
  budget: string
  spent: string
  remaining: string
  utilization: string
  over_budget: boolean
}

export interface BudgetSummary {
  year: number
  month: number
  currency: string
  overall_budget: string | null
  overall_budget_id: number | null
  overall_spending: string
  overall_remaining: string | null
  overall_utilization: string | null
  overall_over_budget: boolean
  overall: OverallBudgetSummary | null
  category_budgets: BudgetCategorySummary[]
  has_overall_budget: boolean
  total_categories_budgeted: number
  has_any_budget: boolean
}

export interface CreateBudgetRequest {
  year: number
  month: number
  category?: string | null
  amount: string
}

export interface UpdateBudgetRequest {
  amount?: string
  category?: string | null
  year?: number
  month?: number
}
