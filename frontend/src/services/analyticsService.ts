import { apiClient } from './apiClient'
import type {
  FinancialSummaryResponse,
  MonthlyAnalyticsResponse,
  CategorySpendingResponse,
  IncomeCategoryResponse,
  DailyTrendResponse,
  MonthFilterParams,
} from '@/types/analytics'

function buildQueryString(params?: MonthFilterParams): string {
  const sp = new URLSearchParams()
  if (params?.year !== undefined) {
    sp.append('year', params.year.toString())
  }
  if (params?.month !== undefined) {
    sp.append('month', params.month.toString())
  }
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: () => ['financial-summary'] as const,
  monthly: (params?: MonthFilterParams) => ['analytics', 'monthly', params?.year, params?.month] as const,
  categories: (params?: MonthFilterParams) => ['analytics', 'categories', params?.year, params?.month] as const,
  incomeCategories: (params?: MonthFilterParams) => ['analytics', 'income-categories', params?.year, params?.month] as const,
  trend: (params?: MonthFilterParams) => ['analytics', 'trend', params?.year, params?.month] as const,
}

export const analyticsService = {
  async getSummary(): Promise<FinancialSummaryResponse> {
    return apiClient<FinancialSummaryResponse>('/api/v1/analytics/summary')
  },

  async getMonthly(params?: MonthFilterParams): Promise<MonthlyAnalyticsResponse> {
    return apiClient<MonthlyAnalyticsResponse>(`/api/v1/analytics/monthly${buildQueryString(params)}`)
  },

  async getCategories(params?: MonthFilterParams): Promise<CategorySpendingResponse> {
    return apiClient<CategorySpendingResponse>(`/api/v1/analytics/categories${buildQueryString(params)}`)
  },

  async getIncomeCategories(params?: MonthFilterParams): Promise<IncomeCategoryResponse> {
    return apiClient<IncomeCategoryResponse>(
      `/api/v1/analytics/income-categories${buildQueryString(params)}`
    )
  },

  async getTrend(params?: MonthFilterParams): Promise<DailyTrendResponse> {
    return apiClient<DailyTrendResponse>(`/api/v1/analytics/trend${buildQueryString(params)}`)
  },
}
