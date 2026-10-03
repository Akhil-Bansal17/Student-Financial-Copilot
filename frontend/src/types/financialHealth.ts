export type CashBufferStatus =
  | 'HEALTHY_BUFFER'
  | 'LIMITED_BUFFER'
  | 'LOW_BUFFER'
  | 'AT_RISK'
  | 'INSUFFICIENT_DATA'

export type CashFlowStabilityStatus =
  | 'STABLE'
  | 'MODERATELY_VARIABLE'
  | 'HIGHLY_VARIABLE'
  | 'NEGATIVE_TREND'
  | 'INSUFFICIENT_DATA'

export type BudgetHealthStatus =
  | 'ON_TRACK'
  | 'APPROACHING_LIMIT'
  | 'OVER_BUDGET'
  | 'NO_ACTIVE_BUDGET'
  | 'INSUFFICIENT_DATA'

export type RecurringBurdenStatus =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL'
  | 'INSUFFICIENT_DATA'

export type GoalHealthStatus =
  | 'ON_TRACK'
  | 'NEEDS_ATTENTION'
  | 'AT_RISK'
  | 'COMPLETED'
  | 'NO_ACTIVE_GOALS'
  | 'INSUFFICIENT_DATA'

export type SpendingPatternStatus =
  | 'BALANCED'
  | 'CONCENTRATED'
  | 'HIGH_GROWTH'
  | 'INSUFFICIENT_DATA'

export type ForecastRiskStatus =
  | 'LOW_RISK'
  | 'MODERATE_RISK'
  | 'HIGH_RISK'
  | 'INSUFFICIENT_DATA'

export type ActionPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INFO'

export type HealthDimension =
  | 'CASH_BUFFER'
  | 'CASH_FLOW_STABILITY'
  | 'BUDGET_HEALTH'
  | 'RECURRING_BURDEN'
  | 'GOAL_HEALTH'
  | 'SPENDING_PATTERN'
  | 'FORECAST_RISK'

export type DataSufficiencyLevel =
  | 'INSUFFICIENT'
  | 'LIMITED'
  | 'MODERATE'
  | 'STRONG'

export interface HealthDimensionDetail {
  dimension: HealthDimension | string
  name: string
  status: string
  label: string
  summary: string
  supporting_data: Record<string, any>
  is_positive: boolean
  is_attention_required: boolean
}

export interface SmartActionItem {
  id: string
  type: string
  title: string
  description: string
  priority: ActionPriority
  reason: string
  supporting_metric?: string | null
  related_entity?: Record<string, any> | null
  recommended_next_step: string
  action_url?: string | null
  generated_at: string
}

export interface PositiveSignalItem {
  id: string
  dimension: string
  title: string
  description: string
  supporting_data?: Record<string, any> | null
}

export interface BankFreshnessDetail {
  connected_accounts_count: number
  has_connected_bank: boolean
  last_synced_at?: string | null
  is_stale: boolean
  sync_status?: string | null
  freshness_description: string
  impacts_assessment: boolean
}

export interface FinancialHealthOverview {
  data_sufficiency: DataSufficiencyLevel
  overall_status_label: string
  overall_summary: string
  critical_actions_count: number
  high_actions_count: number
  total_actions_count: number
  positive_signals_count: number
  primary_attention_dimension?: string | null
}

export interface FinancialHealthResponse {
  overview: FinancialHealthOverview
  dimensions: Record<string, HealthDimensionDetail>
  actions: SmartActionItem[]
  positive_signals: PositiveSignalItem[]
  bank_freshness: BankFreshnessDetail
  data_sufficiency: DataSufficiencyLevel
  generated_at: string
}

export interface SmartActionsResponse {
  total_count: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  actions: SmartActionItem[]
  generated_at: string
}
