import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/App'
import { tokenStorage, authService } from '@/services/authService'
import { profileService } from '@/services/profileService'
import type { User, FinancialProfile } from '@/types'

const ONBOARDING_DRAFT_KEY = 'sfc_onboarding_draft'

const uncompletedStudent: User = {
  id: 42,
  email: 'new.student@campus.edu',
  full_name: 'Jordan Lee',
  is_active: true,
  onboarding_completed: false,
  created_at: '2026-09-23T00:00:00Z',
  updated_at: '2026-09-23T00:00:00Z',
}

const completedStudent: User = {
  ...uncompletedStudent,
  onboarding_completed: true,
}

const mockProfile: FinancialProfile = {
  id: 1,
  user_id: 42,
  starting_balance: '1500.00',
  onboarding_completed: true,
  money_sources: ['Pocket Money', 'Freelance'],
  financial_focus: ['Track my spending'],
  created_at: '2026-09-23T00:00:00Z',
  updated_at: '2026-09-23T00:00:00Z',
}

describe('Student Onboarding Flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
    tokenStorage.setToken('mock-auth-token')
    vi.restoreAllMocks()
  })

  it('1. redirects uncompleted authenticated user from / to /onboarding', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(uncompletedStudent)

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Welcome to Student Financial Copilot/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/Hey, Jordan!/i)).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
    })
  })

  it('2. navigates through step 1 to step 2 (money sources)', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(uncompletedStudent)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /How do you usually receive money\?/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/Pocket Money/i)).toBeInTheDocument()
      expect(screen.getByText(/Family Support/i)).toBeInTheDocument()
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })
  })

  it('3. validates that at least one money source is selected in step 2', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(uncompletedStudent)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })

    // Click continue without selecting anything
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Please select at least one way you usually receive money/i
      )
    })

    // Select "Pocket Money" and "Freelance"
    fireEvent.click(screen.getByText('Pocket Money'))
    fireEvent.click(screen.getByText('Freelance'))

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Advances to Step 3
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /How much money do you currently have\?/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument()
    })
  })

  it('4. validates starting balance input: accepts zero, rejects negative numbers', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(uncompletedStudent)

    render(<App />)

    // Advance to step 2
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Advance to step 3 with selected source
    await waitFor(() => {
      expect(screen.getByText('Pocket Money')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Pocket Money'))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument()
    })

    const balanceInput = screen.getByLabelText(/Current Money/i)

    // Test negative input
    fireEvent.change(balanceInput, { target: { value: '-25' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Starting balance cannot be negative/i
      )
    })

    // Test zero input (students can have ₹0)
    fireEvent.change(balanceInput, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Advances to step 4
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /What would you like to focus on\?/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument()
    })
  })

  it('5. allows selecting financial focus options and back navigation works', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(uncompletedStudent)

    render(<App />)

    // Step 1 -> Step 2
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Step 2 -> Step 3
    await waitFor(() => {
      expect(screen.getByText('Pocket Money')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Pocket Money'))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Step 3 -> Step 4 with ₹500
    await waitFor(() => {
      expect(screen.getByLabelText(/Current Money/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Current Money/i), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Step 4
    await waitFor(() => {
      expect(screen.getByText('Track my spending')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Track my spending'))

    // Test Back button -> returns to Step 3 with value preserved
    fireEvent.click(screen.getByRole('button', { name: /Previous step/i }))

    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Current Money/i)).toHaveValue(500)
    })

    // Go forward again to Step 4 and then Step 5
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Step 5: Completion Review
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /You're all set 🎉/i })).toBeInTheDocument()
      expect(screen.getByText(/Your financial space is ready/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument()
    })
  })

  it('6. completes onboarding, updates user session, and navigates to dashboard', async () => {
    const userSpy = vi.spyOn(authService, 'getCurrentUser')
    userSpy.mockResolvedValueOnce(uncompletedStudent) // initial mount
    const completeSpy = vi
      .spyOn(profileService, 'completeOnboarding')
      .mockResolvedValueOnce(mockProfile)

    render(<App />)

    // Move to step 2
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Select source & move to step 3
    await waitFor(() => {
      expect(screen.getByText('Salary')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Salary'))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Set balance & move to step 4
    await waitFor(() => {
      expect(screen.getByLabelText(/Current Money/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Current Money/i), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Move to step 5
    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    // Step 5
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Go to Dashboard/i })).toBeInTheDocument()
    })

    // Prepare mock for refreshUser after completion
    userSpy.mockResolvedValueOnce(completedStudent)

    fireEvent.click(screen.getByRole('button', { name: /Go to Dashboard/i }))

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith({
        starting_balance: '1500.00',
        money_sources: ['Salary'],
        financial_focus: [],
      })
      expect(sessionStorage.getItem(ONBOARDING_DRAFT_KEY)).toBeNull()
      // Now on Dashboard
      expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
    })
  })

  it('7. completed user visiting /onboarding is redirected back to /', async () => {
    window.history.pushState({}, '', '/onboarding')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(completedStudent)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /Welcome to Student Financial Copilot/i })).toBeNull()
    })
  })
})
