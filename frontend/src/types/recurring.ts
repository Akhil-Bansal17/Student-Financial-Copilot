import type { Transaction } from './transaction'

export type RecurringType =
  | 'SUBSCRIPTION'
  | 'RECURRING_BILL'
  | 'RECURRING_EXPENSE'
  | 'RECURRING_OTHER'

export type RecurringFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'

export type RecurringStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'USER_IGNORED'
  | 'OVERDUE_EXPECTED'
  | 'POSSIBLY_ENDED'

export type RecurringConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type RecurringPreferenceType = 'IGNORE' | 'RECURRING' | 'SUBSCRIPTION' | 'BILL'

export interface RecurringPreference {
  id: number
  user_id: number
  normalized_merchant: string
  preference_type: RecurringPreferenceType | string
  created_at: string
  updated_at: string
}

export interface RecurringPreferenceCreate {
  normalized_merchant: string
  preference_type: RecurringPreferenceType
}

export interface RecurringExpense {
  id: number
  user_id: number
  merchant: string
  normalized_merchant: string
  category: string
  recurring_type: RecurringType | string
  frequency: RecurringFrequency | string
  is_variable_amount: boolean
  confidence: RecurringConfidence | string
  status: RecurringStatus | string
  average_amount: string | number
  latest_amount: string | number
  previous_amount?: string | number | null
  min_amount: string | number
  max_amount: string | number
  amount_change?: string | number | null
  amount_change_percentage?: string | number | null
  occurrence_count: number
  last_occurrence_date: string
  next_expected_date: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface RecurringExpenseUpdate {
  status?: RecurringStatus
  recurring_type?: RecurringType
  frequency?: RecurringFrequency
  category?: string
  notes?: string
}

export interface RecurringExpenseDetail {
  recurring: RecurringExpense
  history: Transaction[]
  user_preference?: RecurringPreference | null
}

export interface RecurringSummary {
  total_monthly_recurring_spend: string | number
  subscription_count: number
  recurring_expense_count: number
  fixed_recurring_spend: string | number
  variable_recurring_spend: string | number
  subscription_monthly_spend: string | number
  bill_monthly_spend: string | number
  other_monthly_spend: string | number
  upcoming_payments: RecurringExpense[]
  recently_changed: RecurringExpense[]
  needs_attention: RecurringExpense[]
  total_detected_count: number
}

export interface RecurringFilters {
  status?: string
  recurring_type?: string
  category?: string
  frequency?: string
}
