import { useQuery } from '@tanstack/react-query'
import { apiClient } from './apiClient'
import { HealthStatus } from '@/types'

export async function fetchHealthStatus(): Promise<HealthStatus> {
  return apiClient<HealthStatus>('/api/v1/health')
}

export function useBackendHealth() {
  return useQuery<HealthStatus, Error>({
    queryKey: ['backend-health'],
    queryFn: fetchHealthStatus,
    retry: 2,
    refetchInterval: 30000, // Check every 30s
  })
}
