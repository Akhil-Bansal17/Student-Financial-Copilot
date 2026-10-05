export type AlertSensitivity = 'CONSERVATIVE' | 'BALANCED' | 'RELAXED'

export type FinancialPriority =
  | 'SAVE_MORE'
  | 'CONTROL_SPENDING'
  | 'STAY_WITHIN_BUDGET'
  | 'BUILD_BUFFER'
  | 'REACH_GOALS'
  | 'UNDERSTAND_SPENDING'
  | 'BALANCED'

import type { DataSufficiencyLevel } from './financialHealth'
export type { DataSufficiencyLevel }

export interface PersonalizationProfile {
  id: number
  user_id: number
  is_personalization_enabled: boolean
  alert_sensitivity: AlertSensitivity
  financial_priority: FinancialPriority
  large_transaction_threshold: string | number | null
  recurring_alert_days_before: number
  created_at: string
  updated_at: string
}

export interface PersonalizationProfileUpdate {
  is_personalization_enabled?: boolean
  alert_sensitivity?: AlertSensitivity
  financial_priority?: FinancialPriority
  large_transaction_threshold?: string | number | null
  recurring_alert_days_before?: number
}

export interface FrequentMerchantSignal {
  merchant_name: string
  transaction_count: number
  total_spend: string | number
  average_amount: string | number
  category: string
  frequency_share_pct: number
}

export interface FrequentCategorySignal {
  category: string
  total_spend: string | number
  percentage: number
  transaction_count: number
}

export interface SpendingTimingSignal {
  weekend_spend_percentage: number
  weekday_spend_percentage: number
  month_start_spend_percentage: number
  month_mid_spend_percentage: number
  month_end_spend_percentage: number
  timing_observation: string
}

export interface BehavioralSignalsResponse {
  data_sufficiency: DataSufficiencyLevel
  transaction_count: number
  analyzed_period_months: number
  typical_transaction_amount: string | number
  average_transaction_amount: string | number
  calculated_large_threshold: string | number
  frequent_merchants: FrequentMerchantSignal[]
  frequent_categories: FrequentCategorySignal[]
  spending_timing: SpendingTimingSignal
  signals_summary: string
  generated_at: string
}

export interface EffectivePersonalizationConfig {
  is_personalization_enabled: boolean
  alert_sensitivity: AlertSensitivity
  financial_priority: FinancialPriority
  effective_large_transaction_threshold: string | number
  is_custom_large_threshold: boolean
  recurring_alert_days_before: number
  minimum_balance_threshold: string | number
  minimum_balance_source: string
  data_sufficiency: DataSufficiencyLevel
  priority_focus_description: string
  top_recommended_action?: {
    id: string
    title: string
    description: string
    priority: string
    action_url?: string | null
    reason: string
  } | null
}
