import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import { App } from '@/App'
import { tokenStorage } from '@/services/authService'
import { mockAuthenticatedUser } from './testUtils'

describe('Student Financial Copilot - Application Smoke Test', () => {
  beforeEach(() => {
    tokenStorage.clearToken()
    vi.restoreAllMocks()
    mockAuthenticatedUser()
  })

  it('renders the application with dashboard greeting and current balance card', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
    })

    // Check greeting
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument()

    // Check supporting metrics
    expect(screen.getByText('Starting')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Spent')).toBeInTheDocument()

    // Scope to main content for transactions and quick actions
    const main = screen.getByRole('main')

    expect(within(main).getByText(/Recent activity/i)).toBeInTheDocument()
    expect(within(main).getByText(/Quick actions/i)).toBeInTheDocument()
    expect(within(main).getByText(/Add Expense/i)).toBeInTheDocument()
    expect(within(main).getByText(/Add Income/i)).toBeInTheDocument()
  })
})
