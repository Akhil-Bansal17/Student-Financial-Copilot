export interface ReconciliationItem {
  id: number;
  user_id: number;
  manual_transaction_id: number | null;
  bank_transaction_id: number | null;
  account_id: number | null;
  external_transaction_id: string | null;
  status: 'PENDING_REVIEW' | 'MATCHED' | 'AUTO_RECONCILED' | 'SEPARATE';
  match_type: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH';
  confidence_score: string | number;
  match_reasons: string[];
  manual_amount: string | number;
  manual_description: string | null;
  manual_category: string;
  manual_date: string;
  bank_amount: string | number;
  bank_description: string | null;
  bank_category: string | null;
  bank_date: string;
  raw_bank_description: string | null;
  reconciled_at: string | null;
  created_at: string;
}

export interface ReconciliationSummary {
  pending_count: number;
  reconciled_count: number;
}

export interface SyncStatusData {
  last_synced_at: string | null;
  sync_status: 'UP_TO_DATE' | 'SYNCING' | 'DELAYED' | 'FAILED' | 'NO_ACCOUNTS';
  is_stale: boolean;
  total_connected_accounts: number;
  total_bank_balance: string | number;
  ledger_balance: string | number;
  balance_difference: string | number;
  pending_reconciliations: number;
}
