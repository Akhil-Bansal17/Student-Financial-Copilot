import { apiClient } from './apiClient'
import type {
  Budget,
  BudgetSummary,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from '@/types/budget'

export const budgetKeys = {
  all: ['budgets'] as const,
  lists: () => ['budgets', 'list'] as const,
  list: (year?: number, month?: number) => ['budgets', 'list', year, month] as const,
  summaries: () => ['budgets', 'summary'] as const,
  summary: (year?: number, month?: number) => ['budgets', 'summary', year, month] as const,
  detail: (id: number) => ['budgets', 'detail', id] as const,
}

function buildQuery(year?: number, month?: number): string {
  const sp = new URLSearchParams()
  if (year !== undefined) sp.append('year', year.toString())
  if (month !== undefined) sp.append('month', month.toString())
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export const budgetService = {
  async getBudgets(year?: number, month?: number): Promise<Budget[]> {
    return apiClient<Budget[]>(`/api/v1/budgets${buildQuery(year, month)}`)
  },

  async getBudgetSummary(year?: number, month?: number): Promise<BudgetSummary> {
    return apiClient<BudgetSummary>(`/api/v1/budgets/summary${buildQuery(year, month)}`)
  },

  async getBudgetById(id: number): Promise<Budget> {
    return apiClient<Budget>(`/api/v1/budgets/${id}`)
  },

  async createBudget(data: CreateBudgetRequest): Promise<Budget> {
    return apiClient<Budget>('/api/v1/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateBudget(id: number, data: UpdateBudgetRequest): Promise<Budget> {
    return apiClient<Budget>(`/api/v1/budgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deleteBudget(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/api/v1/budgets/${id}`, {
      method: 'DELETE',
    })
  },
}
