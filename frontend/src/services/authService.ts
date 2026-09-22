import { apiClient } from './apiClient'
import { AuthResponse, User } from '@/types'

const TOKEN_STORAGE_KEY = 'sfc_access_token'

export const tokenStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch {
      // Ignore in environments where localStorage is blocked
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // Ignore
    }
  },
}

export interface RegisterPayload {
  email: string
  password: string
  confirm_password: string
  full_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authService = {
  getToken(): string | null {
    return tokenStorage.getToken()
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiClient<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (response.access_token) {
      tokenStorage.setToken(response.access_token)
    }
    return response
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiClient<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (response.access_token) {
      tokenStorage.setToken(response.access_token)
    }
    return response
  },

  async getCurrentUser(): Promise<User> {
    return apiClient<User>('/api/v1/auth/me')
  },

  async logout(): Promise<void> {
    try {
      await apiClient('/api/v1/auth/logout', { method: 'POST' })
    } catch {
      // Proceed with client logout even if server is unreachable
    } finally {
      tokenStorage.clearToken()
    }
  },
}
