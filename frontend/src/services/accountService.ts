import { apiClient } from './apiClient'
import type {
  ConnectedAccount,
  ConnectedAccountListResponse,
  SyncRun,
  AccountDisconnectResponse,
  ConsentInitiationRequest,
  ConsentInitiationResponse,
  ConsentCallbackRequest,
  ConsentCallbackResponse,
} from '@/types/account'

export const accountService = {
  async getAccounts(): Promise<ConnectedAccountListResponse> {
    return apiClient<ConnectedAccountListResponse>('/api/v1/accounts')
  },

  async connectMock(): Promise<ConnectedAccount> {
    return apiClient<ConnectedAccount>('/api/v1/accounts/connect/mock', {
      method: 'POST',
    })
  },

  async initiateConsent(req: ConsentInitiationRequest = {}): Promise<ConsentInitiationResponse> {
    return apiClient<ConsentInitiationResponse>('/api/v1/accounts/consent/initiate', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  async handleConsentCallback(req: ConsentCallbackRequest): Promise<ConsentCallbackResponse> {
    return apiClient<ConsentCallbackResponse>('/api/v1/accounts/consent/callback', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  async getAccount(id: number): Promise<ConnectedAccount> {
    return apiClient<ConnectedAccount>(`/api/v1/accounts/${id}`)
  },

  async syncAccount(id: number): Promise<SyncRun> {
    return apiClient<SyncRun>(`/api/v1/accounts/${id}/sync`, {
      method: 'POST',
    })
  },

  async disconnectAccount(id: number): Promise<AccountDisconnectResponse> {
    return apiClient<AccountDisconnectResponse>(`/api/v1/accounts/${id}/disconnect`, {
      method: 'POST',
    })
  },

  async getSyncHistory(id: number, limit: number = 20): Promise<SyncRun[]> {
    return apiClient<SyncRun[]>(`/api/v1/accounts/${id}/sync-history?limit=${limit}`)
  },

  async syncAll(): Promise<SyncRun[]> {
    return apiClient<SyncRun[]>('/api/v1/accounts/sync-all', {
      method: 'POST',
    })
  },
}

