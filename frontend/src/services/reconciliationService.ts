import { apiClient } from './apiClient'
import type { ReconciliationItem, ReconciliationSummary, SyncStatusData } from '../types/reconciliation'

export const reconciliationService = {
  /**
   * Fetch all pending reconciliation items requiring student review.
   */
  getPendingReconciliations: async (): Promise<ReconciliationItem[]> => {
    return apiClient<ReconciliationItem[]>('/api/v1/reconciliation/pending')
  },

  /**
   * Fetch summary counts of pending and reconciled transactions.
   */
  getReconciliationSummary: async (): Promise<ReconciliationSummary> => {
    return apiClient<ReconciliationSummary>('/api/v1/reconciliation/summary')
  },

  /**
   * Confirm match between manual transaction and bank transaction.
   */
  matchReconciliation: async (reconciliationId: number): Promise<ReconciliationItem> => {
    return apiClient<ReconciliationItem>(`/api/v1/reconciliation/${reconciliationId}/match`, {
      method: 'POST',
    })
  },

  /**
   * Keep transactions separate and import the bank transaction into the ledger.
   */
  keepSeparateReconciliation: async (
    reconciliationId: number
  ): Promise<{ status: string; message: string; transaction_id: number }> => {
    return apiClient<{ status: string; message: string; transaction_id: number }>(
      `/api/v1/reconciliation/${reconciliationId}/keep-separate`,
      {
        method: 'POST',
      }
    )
  },

  /**
   * Get sync freshness, balance differences, and staleness status.
   */
  getSyncFreshnessStatus: async (): Promise<SyncStatusData> => {
    return apiClient<SyncStatusData>('/api/v1/reconciliation/status')
  },
}
