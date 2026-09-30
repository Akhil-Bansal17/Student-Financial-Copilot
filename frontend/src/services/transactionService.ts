import { apiClient } from './apiClient'
import type {
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  TransactionListResponse,
  FinancialSummaryResponse,
  TransactionFilters,
  BulkCategoryPayload,
  BulkCategoryResponse,
  MerchantPreference,
} from '@/types/transaction'

export const transactionService = {
  async getTransactions(filters?: TransactionFilters): Promise<TransactionListResponse> {
    const params = new URLSearchParams()
    if (filters?.transaction_type) {
      params.append('transaction_type', filters.transaction_type)
    }
    if (filters?.category) {
      params.append('category', filters.category)
    }
    if (filters?.search) {
      params.append('search', filters.search)
    }
    if (filters?.merchant) {
      params.append('merchant', filters.merchant)
    }
    if (filters?.source) {
      params.append('source', filters.source)
    }
    if (filters?.account_id !== undefined) {
      params.append('account_id', filters.account_id.toString())
    }
    if (filters?.start_date) {
      params.append('start_date', filters.start_date)
    }
    if (filters?.end_date) {
      params.append('end_date', filters.end_date)
    }
    if (filters?.min_amount !== undefined) {
      params.append('min_amount', filters.min_amount.toString())
    }
    if (filters?.max_amount !== undefined) {
      params.append('max_amount', filters.max_amount.toString())
    }
    if (filters?.reconciliation_status) {
      params.append('reconciliation_status', filters.reconciliation_status)
    }
    if (filters?.limit !== undefined) {
      params.append('limit', filters.limit.toString())
    }
    if (filters?.offset !== undefined) {
      params.append('offset', filters.offset.toString())
    }

    const qs = params.toString()
    const endpoint = `/api/v1/transactions${qs ? `?${qs}` : ''}`
    return apiClient<TransactionListResponse>(endpoint)
  },

  async getTransaction(id: number): Promise<Transaction> {
    return apiClient<Transaction>(`/api/v1/transactions/${id}`)
  },

  async createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
    return apiClient<Transaction>('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateTransaction(
    id: number,
    payload: UpdateTransactionPayload
  ): Promise<Transaction> {
    return apiClient<Transaction>(`/api/v1/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  async bulkUpdateCategory(payload: BulkCategoryPayload): Promise<BulkCategoryResponse> {
    return apiClient<BulkCategoryResponse>('/api/v1/transactions/bulk-category', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async deleteTransaction(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/v1/transactions/${id}`,
      {
        method: 'DELETE',
      }
    )
  },

  async getSummary(): Promise<FinancialSummaryResponse> {
    return apiClient<FinancialSummaryResponse>('/api/v1/analytics/summary')
  },

  // Merchant Preferences (Phase 11)
  async getMerchantPreferences(): Promise<MerchantPreference[]> {
    return apiClient<MerchantPreference[]>('/api/v1/merchant-preferences')
  },

  async createMerchantPreference(payload: {
    normalized_merchant: string
    category: string
  }): Promise<MerchantPreference> {
    return apiClient<MerchantPreference>('/api/v1/merchant-preferences', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateMerchantPreference(
    id: number,
    category: string
  ): Promise<MerchantPreference> {
    return apiClient<MerchantPreference>(`/api/v1/merchant-preferences/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ category }),
    })
  },

  async deleteMerchantPreference(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/v1/merchant-preferences/${id}`,
      {
        method: 'DELETE',
      }
    )
  },
}
