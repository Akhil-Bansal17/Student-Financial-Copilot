export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type NotificationCategory =
  | 'forecast'
  | 'budget'
  | 'goals'
  | 'recurring'
  | 'bank'
  | 'spending'
  | 'financial_health'
  | 'positive';

export interface NotificationItem {
  id: number;
  user_id: number;
  notification_type: string;
  priority: NotificationPriority;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  dedupe_key: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  expires_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total_count: number;
  unread_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UnreadCountResponse {
  unread_count: number;
  critical_count: number;
  high_count: number;
}

export interface NotificationPreference {
  id: number;
  user_id: number;
  smart_alerts_enabled: boolean;
  forecast_alerts_enabled: boolean;
  budget_alerts_enabled: boolean;
  goal_alerts_enabled: boolean;
  recurring_alerts_enabled: boolean;
  bank_alerts_enabled: boolean;
  spending_alerts_enabled: boolean;
  positive_alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceUpdate {
  smart_alerts_enabled?: boolean;
  forecast_alerts_enabled?: boolean;
  budget_alerts_enabled?: boolean;
  goal_alerts_enabled?: boolean;
  recurring_alerts_enabled?: boolean;
  bank_alerts_enabled?: boolean;
  spending_alerts_enabled?: boolean;
  positive_alerts_enabled?: boolean;
}

export interface AlertEvaluationResult {
  evaluated_count: number;
  created_count: number;
  skipped_dedupe_count: number;
  suppressed_count: number;
  created_notifications: NotificationItem[];
}
