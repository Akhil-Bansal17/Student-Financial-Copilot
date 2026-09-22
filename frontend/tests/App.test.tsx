import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { App } from '@/App'

describe('Student Financial Copilot - Application Smoke Test', () => {
  it('renders the application with dashboard greeting and safe to spend card', () => {
    render(<App />)

    // Check greeting
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument()

    // Check main financial hero card
    expect(screen.getByText(/Safe to spend/i)).toBeInTheDocument()
    expect(screen.getByText(/You're on track this month/i)).toBeInTheDocument()

    // Check supporting metrics
    expect(screen.getByText(/Available/i)).toBeInTheDocument()
    expect(screen.getByText(/Spent/i)).toBeInTheDocument()
    expect(screen.getByText(/Savings/i)).toBeInTheDocument()

    // Scope to main content for transactions and upcoming bills
    const main = screen.getByRole('main')

    expect(within(main).getByText(/Recent activity/i)).toBeInTheDocument()
    expect(within(main).getByText('Food')).toBeInTheDocument()
    expect(within(main).getByText('Metro')).toBeInTheDocument()
    expect(within(main).getByText('Pocket Money')).toBeInTheDocument()

    // Check insight card
    expect(
      within(main).getByText(/Food spending is higher than your usual monthly average/i)
    ).toBeInTheDocument()

    // Check upcoming expenses
    expect(within(main).getByText(/Upcoming expenses/i)).toBeInTheDocument()
    expect(within(main).getByText('Netflix')).toBeInTheDocument()
    expect(within(main).getByText('Hostel')).toBeInTheDocument()
  })
})
