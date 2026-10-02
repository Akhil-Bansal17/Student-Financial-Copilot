import { apiClient } from './apiClient'
import type {
  RecurringExpense,
  RecurringExpenseDetail,
  RecurringExpenseUpdate,
  RecurringSummary,
  RecurringPreference,
  RecurringPreferenceCreate,
  RecurringFilters,
} from '@/types/recurring'

export const recurringKeys = {
  all: ['recurring'] as const,
  lists: () => ['recurring', 'list'] as const,
  list: (filters?: RecurringFilters) => ['recurring', 'list', filters] as const,
  summary: () => ['recurring', 'summary'] as const,
  detail: (id: number) => ['recurring', 'detail', id] as const,
  preferences: () => ['recurring', 'preferences'] as const,
}

function buildQuery(filters?: RecurringFilters): string {
  if (!filters) return ''
  const sp = new URLSearchParams()
  if (filters.status) sp.append('status', filters.status)
  if (filters.recurring_type) sp.append('recurring_type', filters.recurring_type)
  if (filters.category) sp.append('category', filters.category)
  if (filters.frequency) sp.append('frequency', filters.frequency)
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const recurringService = {
  async getRecurringExpenses(filters?: RecurringFilters): Promise<RecurringExpense[]> {
    return apiClient<RecurringExpense[]>(`/api/v1/recurring${buildQuery(filters)}`)
  },

  async getSummary(): Promise<RecurringSummary> {
    return apiClient<RecurringSummary>('/api/v1/recurring/summary')
  },

  async detectRecurring(): Promise<RecurringExpense[]> {
    return apiClient<RecurringExpense[]>('/api/v1/recurring/detect', {
      method: 'POST',
    })
  },

  async getRecurringDetail(id: number): Promise<RecurringExpenseDetail> {
    return apiClient<RecurringExpenseDetail>(`/api/v1/recurring/${id}`)
  },

  async updateRecurringExpense(
    id: number,
    data: RecurringExpenseUpdate
  ): Promise<RecurringExpense> {
    return apiClient<RecurringExpense>(`/api/v1/recurring/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async ignoreRecurringExpense(id: number): Promise<RecurringExpense> {
    return apiClient<RecurringExpense>(`/api/v1/recurring/${id}/ignore`, {
      method: 'POST',
    })
  },

  async confirmRecurringExpense(
    id: number,
    markAsSubscription = false
  ): Promise<RecurringExpense> {
    const sp = new URLSearchParams()
    if (markAsSubscription) sp.append('mark_as_subscription', 'true')
    const qs = sp.toString() ? `?${sp.toString()}` : ''
    return apiClient<RecurringExpense>(`/api/v1/recurring/${id}/confirm${qs}`, {
      method: 'POST',
    })
  },

  async getPreferences(): Promise<RecurringPreference[]> {
    return apiClient<RecurringPreference[]>('/api/v1/recurring/preferences')
  },

  async setPreference(data: RecurringPreferenceCreate): Promise<RecurringPreference> {
    return apiClient<RecurringPreference>('/api/v1/recurring/preferences', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deletePreference(merchant: string): Promise<void> {
    await apiClient<void>(`/api/v1/recurring/preferences/${encodeURIComponent(merchant)}`, {
      method: 'DELETE',
    })
  },
}
