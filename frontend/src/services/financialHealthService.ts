import { apiClient } from './apiClient'
import type {
  FinancialHealthResponse,
  SmartActionsResponse,
} from '@/types/financialHealth'

export const financialHealthKeys = {
  all: ['financialHealth'] as const,
  overview: () => ['financialHealth', 'overview'] as const,
  actions: () => ['financialHealth', 'actions'] as const,
}

export const financialHealthService = {
  async getFinancialHealth(): Promise<FinancialHealthResponse> {
    return apiClient<FinancialHealthResponse>('/api/v1/financial-health')
  },

  async getSmartActions(): Promise<SmartActionsResponse> {
    return apiClient<SmartActionsResponse>('/api/v1/financial-health/actions')
  },
}
