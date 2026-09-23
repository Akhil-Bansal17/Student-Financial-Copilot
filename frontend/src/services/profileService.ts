import { apiClient } from './apiClient'
import type {
  FinancialProfile,
  FinancialProfileUpdatePayload,
  OnboardingCompletePayload,
} from '@/types'

export const profileService = {
  async getFinancialProfile(): Promise<FinancialProfile> {
    return apiClient<FinancialProfile>('/api/v1/profile/financial')
  },

  async updateFinancialProfile(
    payload: FinancialProfileUpdatePayload
  ): Promise<FinancialProfile> {
    return apiClient<FinancialProfile>('/api/v1/profile/financial', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  async completeOnboarding(
    payload?: OnboardingCompletePayload
  ): Promise<FinancialProfile> {
    return apiClient<FinancialProfile>('/api/v1/profile/onboarding/complete', {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    })
  },
}
