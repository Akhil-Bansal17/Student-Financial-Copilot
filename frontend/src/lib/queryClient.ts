import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Do not retry client/auth errors
        const status = (error as { status?: number })?.status
        if (status && [401, 403, 404, 422].includes(status)) {
          return false
        }
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
})
