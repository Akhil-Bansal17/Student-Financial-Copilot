import { apiClient } from './apiClient'
import type {
  PersonalizationProfile,
  PersonalizationProfileUpdate,
  BehavioralSignalsResponse,
  EffectivePersonalizationConfig,
} from '@/types'

export const personalizationKeys = {
  all: ['personalization'] as const,
  profile: () => ['personalization', 'profile'] as const,
  signals: () => ['personalization', 'signals'] as const,
  effective: () => ['personalization', 'effective'] as const,
}

export const personalizationService = {
  async getProfile(): Promise<PersonalizationProfile> {
    return apiClient<PersonalizationProfile>('/api/v1/personalization')
  },

  async updateProfile(updates: PersonalizationProfileUpdate): Promise<PersonalizationProfile> {
    return apiClient<PersonalizationProfile>('/api/v1/personalization', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },

  async resetProfile(): Promise<PersonalizationProfile> {
    return apiClient<PersonalizationProfile>('/api/v1/personalization/reset', {
      method: 'POST',
    })
  },

  async getBehavioralSignals(): Promise<BehavioralSignalsResponse> {
    return apiClient<BehavioralSignalsResponse>('/api/v1/personalization/signals')
  },

  async getEffectiveConfig(): Promise<EffectivePersonalizationConfig> {
    return apiClient<EffectivePersonalizationConfig>('/api/v1/personalization/effective')
  },
}
