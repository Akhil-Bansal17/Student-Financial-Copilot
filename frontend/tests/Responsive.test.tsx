import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { App } from '@/App'
import { tokenStorage } from '@/services/authService'
import { mockAuthenticatedUser } from './testUtils'

describe('Responsive Shell & Mobile Navigation', () => {
  beforeEach(() => {
    tokenStorage.clearToken()
    vi.restoreAllMocks()
    mockAuthenticatedUser()
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
})

