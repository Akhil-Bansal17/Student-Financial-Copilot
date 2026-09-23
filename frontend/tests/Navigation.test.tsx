import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { App } from '@/App'
import { tokenStorage } from '@/services/authService'
import { mockAuthenticatedUser } from './testUtils'

describe('Navigation and Routing', () => {
  beforeEach(() => {
    tokenStorage.clearToken()
    vi.restoreAllMocks()
    mockAuthenticatedUser()
  })

  it('navigates to Activity, Insights, Goals, and More pages via navigation links', async () => {
    render(<App />)

    // Initially on Home / Dashboard
    await waitFor(() => {
      expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
    })

    const main = screen.getByRole('main')

    // Click on Activity link in bottom navigation
    const mobileNav = screen.getByRole('navigation', { name: /Mobile Navigation/i })
    const activityLink = within(mobileNav).getByRole('link', { name: /Activity/i })
    fireEvent.click(activityLink)

    expect(within(main).getByText(/Activity & Transactions/i)).toBeInTheDocument()

    // Click on Insights
    const insightsLink = within(mobileNav).getByRole('link', { name: /Insights/i })
    fireEvent.click(insightsLink)
    expect(within(main).getByText(/Financial Insights/i)).toBeInTheDocument()

    // Click on Goals
    const goalsLink = within(mobileNav).getByRole('link', { name: /Goals/i })
    fireEvent.click(goalsLink)
    expect(within(main).getByText(/Savings Goals/i)).toBeInTheDocument()

    // Click on More
    const moreLink = within(mobileNav).getByRole('link', { name: /More/i })
    fireEvent.click(moreLink)
    expect(within(main).getByText(/More & Settings/i)).toBeInTheDocument()
  })
})
