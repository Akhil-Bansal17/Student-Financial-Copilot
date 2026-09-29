export type AccountStatus = 'ACTIVE' | 'DISCONNECTED' | 'REVOKED' | 'ERROR'

export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface ConnectedAccount {
  id: number
  user_id: number
  provider: string
  provider_account_id: string
  institution_name: string
  account_type: string
  masked_account_number: string
  currency: string
  current_balance: number | string | null
  balance_as_of: string | null
  status: AccountStatus
  last_synced_at: string | null
  created_at: string
  updated_at: string
  is_sandbox?: boolean
}

export interface ConnectedAccountListResponse {
  items: ConnectedAccount[]
  total_connected_balance: number | string
  total_accounts: number
}

export interface SyncRun {
  id: number
  user_id: number
  account_id: number
  provider: string
  status: SyncStatus
  transactions_fetched: number
  transactions_imported: number
  transactions_skipped: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface AccountDisconnectResponse {
  success: boolean
  message: string
  account: ConnectedAccount
}
