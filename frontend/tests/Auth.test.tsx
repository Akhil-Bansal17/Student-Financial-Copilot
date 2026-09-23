import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/App'
import { tokenStorage, authService } from '@/services/authService'
import { ApiError } from '@/services/apiClient'

describe('Frontend Authentication Flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    tokenStorage.clearToken()
    vi.restoreAllMocks()
  })

  it('1. redirects unauthenticated users from protected routes to /login', async () => {
    render(<App />)

    // Wait for auth resolution
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Student Email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
    })
  })

  it('2. renders registration page when navigating to /register', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Don't have an account\?/i)).toBeInTheDocument()
    })

    const registerLink = screen.getByRole('link', { name: /Create one/i })
    fireEvent.click(registerLink)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Create student account/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument()
    })
  })

  it('3. validates password confirmation mismatch on register form', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Create one/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('link', { name: /Create one/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Student Email Address/i), {
      target: { value: 'student@campus.edu' },
    })
    fireEvent.change(screen.getByLabelText(/^Password \(min 8 characters\)$/i), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'MismatchPassword99!' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Passwords do not match/i)
    })
  })

  it('4. displays friendly error message on invalid login credentials', async () => {
    vi.spyOn(authService, 'login').mockRejectedValueOnce(
      new ApiError(401, 'Invalid email or password')
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByLabelText(/Student Email/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Student Email/i), {
      target: { value: 'wrong@campus.edu' },
    })
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'WrongPassword123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Log in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Invalid email or password\. Please check your credentials\./i
      )
    })
  })

  it('5. allows authenticated users to view protected dashboard', async () => {
    tokenStorage.setToken('mock-valid-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValueOnce({
      id: 101,
      email: 'verified.student@campus.edu',
      full_name: 'Verified Student',
      is_active: true,
      onboarding_completed: true,
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Good morning/i)).toBeInTheDocument()
      expect(screen.getByText(/Safe to spend/i)).toBeInTheDocument()
    })
  })

  it('6. clears auth session and redirects to /login on logout', async () => {
    tokenStorage.setToken('mock-valid-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 101,
      email: 'verified.student@campus.edu',
      full_name: 'Verified Student',
      is_active: true,
      onboarding_completed: true,
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-09-22T00:00:00Z',
    })
    const logoutSpy = vi.spyOn(authService, 'logout').mockResolvedValueOnce()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/Safe to spend/i)).toBeInTheDocument()
    })

    // Navigate to More page
    const mobileNav = screen.getByRole('navigation', { name: /Mobile Navigation/i })
    const moreLink = mobileNav.querySelector('a[href="/more"]')
    expect(moreLink).toBeInTheDocument()
    fireEvent.click(moreLink!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log out of FinCopilot/i })).toBeInTheDocument()
    })

    // Click Logout button
    fireEvent.click(screen.getByRole('button', { name: /Log out of FinCopilot/i }))

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled()
      expect(tokenStorage.getToken()).toBeNull()
      expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument()
    })
  })
})
