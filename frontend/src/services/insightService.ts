import { apiClient } from './apiClient'
import type { InsightsResponse } from '@/types/insight'

export const insightKeys = {
  all: ['insights'] as const,
  period: (year?: number, month?: number) => ['insights', 'period', year, month] as const,
}

export const insightService = {
  async getInsights(year?: number, month?: number): Promise<InsightsResponse> {
    const params = new URLSearchParams()
    if (year !== undefined) params.append('year', String(year))
    if (month !== undefined) params.append('month', String(month))
    const qs = params.toString() ? `?${params.toString()}` : ''
    return apiClient<InsightsResponse>(`/api/v1/insights${qs}`)
  },
}
