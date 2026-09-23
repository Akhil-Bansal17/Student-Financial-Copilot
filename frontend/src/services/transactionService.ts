import { apiClient } from './apiClient'
import type {
  Transaction,
  CreateTransactionPayload,
  UpdateTransactionPayload,
  TransactionListResponse,
  FinancialSummaryResponse,
  TransactionFilters,
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
    if (filters?.start_date) {
      params.append('start_date', filters.start_date)
    }
    if (filters?.end_date) {
      params.append('end_date', filters.end_date)
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

  async deleteTransaction(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/v1/transactions/${id}`,
      {
        method: 'DELETE',
      }
    )
  },

  async getSummary(): Promise<FinancialSummaryResponse> {
    return apiClient<FinancialSummaryResponse>('/api/v1/transactions/summary')
  },
}
