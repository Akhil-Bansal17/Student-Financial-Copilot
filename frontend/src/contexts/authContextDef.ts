import { createContext } from 'react'
import type { User } from '@/types'
import type { LoginPayload, RegisterPayload } from '@/services/authService'

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
