export type ForecastHorizon = 7 | 30 | 90

export type DataSufficiencyLevel = 'INSUFFICIENT' | 'LIMITED' | 'MODERATE' | 'STRONG'

export type ForecastConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type ForecastEventType =
  | 'EXPECTED_INCOME'
  | 'RECURRING_EXPENSE'
  | 'RECURRING_SUBSCRIPTION'
  | 'RECURRING_BILL'
  | 'ESTIMATED_SPENDING'
  | 'GOAL_ALLOCATION'
  | 'OTHER'

export interface ForecastEventResponse {
  id: string
  date: string
  type: ForecastEventType | string
  name: string
  amount: string | number
  is_inflow: boolean
  category?: string | null
  source: string
  is_known_commitment: boolean
  projected_balance_after: string | number
}

export interface ForecastDailyPointResponse {
  date: string
  projected_balance: string | number
  is_actual: boolean
  events_count: number
  daily_inflow: string | number
  daily_outflow: string | number
  is_below_minimum: boolean
  is_negative: boolean
}

export interface ForecastGoalPlanning {
  goal_id: number
  goal_name: string
  target_amount: string | number
  current_amount: string | number
  remaining_amount: string | number
  target_date?: string | null
  suggested_monthly_allocation?: string | number | null
  is_affordable: boolean
}

export interface ForecastBudgetPressure {
  budget_id: number
  category: string
  allocated_amount: string | number
  spent_amount: string | number
  projected_recurring_spend: string | number
  projected_total_spend: string | number
  utilization_percentage: string | number
  projected_over_budget: boolean
}

export interface CashFlowForecastResponse {
  current_ledger_balance: string | number
  current_connected_bank_balance?: string | number | null
  starting_balance: string | number
  projected_balance: string | number
  net_cash_flow: string | number
  forecast_days: number
  expected_income: string | number
  expected_recurring_expenses: string | number
  estimated_discretionary_spending: string | number
  projected_total_outflow: string | number
  minimum_projected_balance: string | number
  minimum_balance_date?: string | null
  is_negative_projected: boolean
  negative_balance_date?: string | null
  is_low_balance_projected: boolean
  low_balance_date?: string | null
  minimum_balance_threshold: string | number
  data_sufficiency: DataSufficiencyLevel | string
  confidence: ForecastConfidenceLevel | string
  bank_data_freshness?: string | null
  bank_last_synced_at?: string | null
  timeline: ForecastEventResponse[]
  daily_points: ForecastDailyPointResponse[]
  goal_planning: ForecastGoalPlanning[]
  budget_pressure: ForecastBudgetPressure[]
  contributing_factors: string[]
  warnings: string[]
}

export interface ForecastSummaryResponse {
  current_ledger_balance: string | number
  current_connected_bank_balance?: string | number | null
  starting_balance: string | number
  projected_balance: string | number
  net_cash_flow: string | number
  forecast_days: number
  expected_income: string | number
  expected_recurring_expenses: string | number
  estimated_discretionary_spending: string | number
  projected_total_outflow: string | number
  minimum_projected_balance: string | number
  minimum_balance_date?: string | null
  is_negative_projected: boolean
  negative_balance_date?: string | null
  is_low_balance_projected: boolean
  low_balance_date?: string | null
  minimum_balance_threshold: string | number
  data_sufficiency: DataSufficiencyLevel | string
  confidence: ForecastConfidenceLevel | string
  bank_data_freshness?: string | null
  bank_last_synced_at?: string | null
}

export interface ForecastTimelineResponse {
  forecast_days: number
  timeline: ForecastEventResponse[]
}

export interface ForecastPreferenceResponse {
  id: number
  user_id: number
  minimum_balance_threshold: string | number
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface ForecastPreferenceUpdate {
  minimum_balance_threshold?: number | string
  is_enabled?: boolean
}
