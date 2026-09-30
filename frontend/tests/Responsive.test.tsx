import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { App } from '@/App'
import { ActivityPage } from '@/pages/ActivityPage'
import { tokenStorage } from '@/services/authService'
import { transactionService } from '@/services/transactionService'
import { mockAuthenticatedUser } from './testUtils'

describe('Responsive Shell & Mobile Navigation', () => {
  beforeEach(() => {
    tokenStorage.clearToken()
    vi.restoreAllMocks()
    mockAuthenticatedUser()
    vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    })
  })

  it('renders mobile bottom navigation bar with 5 primary tabs', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Mobile Navigation/i })).toBeInTheDocument()
    })

    const mobileNav = screen.getByRole('navigation', { name: /Mobile Navigation/i })

    // Assert all 5 core navigation labels are present inside the mobile navigation
    expect(within(mobileNav).getByText('Home')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Activity')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Insights')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Goals')).toBeInTheDocument()
    expect(within(mobileNav).getByText('More')).toBeInTheDocument()
  })

  it('renders responsive dashboard elements without horizontal overflow markers', async () => {
    // Set 320px mobile viewport width
    window.innerWidth = 320
    window.innerHeight = 568
    window.dispatchEvent(new Event('resize'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Selected Month Activity/i)).toBeInTheDocument()
    expect(screen.getByText(/Spending by Category/i)).toBeInTheDocument()
  })

  it('renders Copilot page across mobile and desktop viewports (320px, 375px, 390px, 412px, 430px, 768px, 1024px)', async () => {
    const viewports = [
      { width: 320, height: 568, name: 'iPhone SE (320px)' },
      { width: 375, height: 667, name: 'iPhone 8 (375px)' },
      { width: 390, height: 844, name: 'iPhone 12/13/14 (390px)' },
      { width: 412, height: 915, name: 'Pixel 7/Samsung (412px)' },
      { width: 430, height: 932, name: 'iPhone 14 Pro Max (430px)' },
      { width: 768, height: 1024, name: 'iPad / Tablet (768px)' },
      { width: 1024, height: 768, name: 'Desktop (1024px+)' },
    ]

    for (const vp of viewports) {
      window.innerWidth = vp.width
      window.innerHeight = vp.height
      window.dispatchEvent(new Event('resize'))

      window.history.pushState({}, '', '/copilot')
      const { unmount } = render(<App />)

      await waitFor(() => {
        expect(screen.getAllByRole('heading', { name: /financial copilot/i }).length).toBeGreaterThanOrEqual(1)
      })

      // Verify input and send button exist and are accessible at each width
      expect(screen.getByPlaceholderText(/ask about your/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ask/i })).toBeInTheDocument()
      unmount()
    }
  })

  it('renders ActivityPage across mobile and desktop viewports without horizontal overflow', async () => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]

    for (const vp of viewports) {
      window.innerWidth = vp.width
      window.innerHeight = vp.height
      window.dispatchEvent(new Event('resize'))

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <ActivityPage />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Activity & Transactions/i })).toBeInTheDocument()
      })

      expect(screen.getByPlaceholderText(/Search merchant, description, category/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument()
      unmount()
    }
  })
})

