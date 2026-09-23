import React, { useState, useEffect, useCallback } from 'react'
import type { User } from '@/types'
import { authService, type LoginPayload, type RegisterPayload, tokenStorage } from '@/services/authService'
import { queryClient } from '@/lib/queryClient'
import { AuthContext, type AuthContextType } from './authContextDef'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const refreshUser = useCallback(async () => {
    const token = tokenStorage.getToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return null
    }

    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch {
      tokenStorage.clearToken()
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const init = async () => {
      const token = tokenStorage.getToken()
      if (!token) {
        if (isMounted) setIsLoading(false)
        return
      }

      try {
        const currentUser = await authService.getCurrentUser()
        if (isMounted) setUser(currentUser)
      } catch {
        tokenStorage.clearToken()
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void init()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (payload: LoginPayload): Promise<User> => {
    const response = await authService.login(payload)
    setUser(response.user)
    queryClient.invalidateQueries()
    return response.user
  }

  const register = async (payload: RegisterPayload): Promise<User> => {
    const response = await authService.register(payload)
    setUser(response.user)
    queryClient.invalidateQueries()
    return response.user
  }

  const logout = async (): Promise<void> => {
    try {
      await authService.logout()
    } finally {
      tokenStorage.clearToken()
      setUser(null)
      queryClient.clear()
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
