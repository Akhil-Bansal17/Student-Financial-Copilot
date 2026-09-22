import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { App } from '@/App'

describe('Responsive Shell & Mobile Navigation', () => {
  it('renders mobile bottom navigation bar with 5 primary tabs', () => {
    render(<App />)

    const mobileNav = screen.getByRole('navigation', { name: /Mobile Navigation/i })
    expect(mobileNav).toBeInTheDocument()

    // Assert all 5 core navigation labels are present inside the mobile navigation
    expect(within(mobileNav).getByText('Home')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Activity')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Insights')).toBeInTheDocument()
    expect(within(mobileNav).getByText('Goals')).toBeInTheDocument()
    expect(within(mobileNav).getByText('More')).toBeInTheDocument()
  })
})
