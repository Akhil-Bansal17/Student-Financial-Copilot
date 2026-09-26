export type InsightType =
  | 'cash_flow'
  | 'top_category'
  | 'spending_trend'
  | 'monthly_change'
  | 'spending_concentration'
  | 'budget'
  | 'goal'
  | 'recurring_pattern'

export type InsightPriority = 'positive' | 'warning' | 'info'

export interface FinancialInsight {
  id: string
  type: InsightType
  priority: InsightPriority
  category: string | null
  title: string
  description: string
  amount: string | null
  percentage: string | null
  period: string
  metadata?: Record<string, unknown> | null
}

export interface InsightsSummaryMetrics {
  total_insights_count: number
  positive_count: number
  warning_count: number
  info_count: number
  has_sufficient_data: boolean
}

export interface InsightsResponse {
  year: number
  month: number
  period: string
  has_sufficient_data: boolean
  summary: InsightsSummaryMetrics
  insights: FinancialInsight[]
}
