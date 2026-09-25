import { apiClient } from './apiClient'
import type {
  Goal,
  GoalsOverview,
  GoalContribution,
  CreateGoalRequest,
  UpdateGoalRequest,
  ContributeToGoalRequest,
} from '@/types/goal'

export const goalKeys = {
  all: ['goals'] as const,
  lists: () => ['goals', 'list'] as const,
  list: (status?: string) => ['goals', 'list', status] as const,
  overview: () => ['goals', 'overview'] as const,
  detail: (id: number) => ['goals', 'detail', id] as const,
  contributions: (id: number) => ['goals', 'contributions', id] as const,
}

export const goalService = {
  async getGoals(status?: string): Promise<Goal[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return apiClient<Goal[]>(`/api/v1/goals${qs}`)
  },

  async getGoalsOverview(): Promise<GoalsOverview> {
    return apiClient<GoalsOverview>('/api/v1/goals/overview')
  },

  async getGoalById(id: number): Promise<Goal> {
    return apiClient<Goal>(`/api/v1/goals/${id}`)
  },

  async createGoal(data: CreateGoalRequest): Promise<Goal> {
    return apiClient<Goal>('/api/v1/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateGoal(id: number, data: UpdateGoalRequest): Promise<Goal> {
    return apiClient<Goal>(`/api/v1/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deleteGoal(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(`/api/v1/goals/${id}`, {
      method: 'DELETE',
    })
  },

  async contributeToGoal(id: number, data: ContributeToGoalRequest): Promise<Goal> {
    return apiClient<Goal>(`/api/v1/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getGoalContributions(id: number): Promise<GoalContribution[]> {
    return apiClient<GoalContribution[]>(`/api/v1/goals/${id}/contributions`)
  },

  async deleteGoalContribution(goalId: number, contributionId: number): Promise<Goal> {
    return apiClient<Goal>(`/api/v1/goals/${goalId}/contributions/${contributionId}`, {
      method: 'DELETE',
    })
  },
}
