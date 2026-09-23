import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingState } from '@/components/common/LoadingState'

export function PublicRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Loading..." compact />
      </div>
    )
  }

  if (isAuthenticated) {
    const destination = user?.onboarding_completed ? '/' : '/onboarding'
    return <Navigate to={destination} replace />
  }

  return <Outlet />
}
