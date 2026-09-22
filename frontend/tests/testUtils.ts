import { vi } from 'vitest'
import { tokenStorage, authService } from '@/services/authService'
import type { User } from '@/types'

export const mockUser: User = {
  id: 1,
  email: 'alex.chen@campus.edu',
  full_name: 'Alex Chen',
  is_active: true,
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
}

export function mockAuthenticatedUser(user: User = mockUser) {
  window.history.pushState({}, '', '/')
  tokenStorage.setToken('mock-auth-token')
  return vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(user)
}
