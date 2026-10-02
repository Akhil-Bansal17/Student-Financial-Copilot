import { apiClient } from './apiClient'
import type {
  CashFlowForecastResponse,
  ForecastSummaryResponse,
  ForecastTimelineResponse,
  ForecastPreferenceResponse,
  ForecastPreferenceUpdate,
} from '@/types/forecast'

export const forecastKeys = {
  all: ['forecast'] as const,
  forecast: (days: number = 30) => ['forecast', 'full', days] as const,
  summary: (days: number = 30) => ['forecast', 'summary', days] as const,
  timeline: (days: number = 30) => ['forecast', 'timeline', days] as const,
  preference: () => ['forecast', 'preference'] as const,
}

export const forecastService = {
  async getForecast(days: number = 30): Promise<CashFlowForecastResponse> {
    return apiClient<CashFlowForecastResponse>(`/api/v1/forecast?days=${days}`)
  },

  async getSummary(days: number = 30): Promise<ForecastSummaryResponse> {
    return apiClient<ForecastSummaryResponse>(`/api/v1/forecast/summary?days=${days}`)
  },

  async getTimeline(days: number = 30): Promise<ForecastTimelineResponse> {
    return apiClient<ForecastTimelineResponse>(`/api/v1/forecast/timeline?days=${days}`)
  },

  async getPreference(): Promise<ForecastPreferenceResponse> {
    return apiClient<ForecastPreferenceResponse>('/api/v1/forecast/preference')
  },

  async updatePreference(
    data: ForecastPreferenceUpdate
  ): Promise<ForecastPreferenceResponse> {
    return apiClient<ForecastPreferenceResponse>('/api/v1/forecast/preference', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
}
