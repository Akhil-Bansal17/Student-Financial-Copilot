import { ApiErrorPayload } from '@/types'
import { tokenStorage } from './authService'

export class ApiError extends Error {
  public status: number
  public details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 8000, ...fetchOptions } = options

  // In development, relative paths route through the Vite proxy to FastAPI backend
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = baseUrl.startsWith('http') ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const token = tokenStorage.getToken()
  const authHeaders: Record<string, string> = {}
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders,
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      let errorData: ApiErrorPayload
      try {
        const json = await response.json()
        errorData = json.error || {
          code: response.status,
          message: json.detail || json.message || response.statusText,
          details: json.details,
        }
      } catch {
        errorData = {
          code: response.status,
          message: `Request failed with status ${response.status} (${response.statusText})`,
        }
      }
      throw new ApiError(errorData.code || response.status, errorData.message, errorData.details)
    }

    return (await response.json()) as T
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please check your network connection.')
    }
    throw new ApiError(
      0,
      err instanceof Error ? err.message : 'An unknown network error occurred. Please try again.'
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
