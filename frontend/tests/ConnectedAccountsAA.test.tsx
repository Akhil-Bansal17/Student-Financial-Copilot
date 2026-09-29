import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConnectedAccountsPage } from '@/pages/ConnectedAccountsPage'
import { accountService } from '@/services/accountService'
import { authService, tokenStorage } from '@/services/authService'
import { queryClient as globalQueryClient } from '@/lib/queryClient'
import type { ConnectedAccount, SyncRun } from '@/types/account'
import type { User } from '@/types'

const mockUser: User = {
  id: 1,
  email: 'aa_student@campus.edu',
  full_name: 'AA Student User',
  is_active: true,
  onboarding_completed: true,
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
}

const mockAccountAA: ConnectedAccount = {
  id: 201,
  user_id: 1,
  provider: 'setu_aa',
  provider_account_id: 'setu_acc_sbi_savings_9841',
  institution_name: 'State Bank of India (Setu AA Sandbox)',
  account_type: 'savings',
  masked_account_number: '••••9841',
  currency: 'INR',
  current_balance: '18450.75',
  balance_as_of: '2026-09-29T10:00:00Z',
  status: 'ACTIVE',
  last_synced_at: '2026-09-29T10:05:00Z',
  created_at: '2026-09-29T09:00:00Z',
  updated_at: '2026-09-29T10:05:00Z',
  is_sandbox: true,
}

const mockSyncRunAA: SyncRun = {
  id: 601,
  user_id: 1,
  account_id: 201,
  provider: 'setu_aa',
  status: 'SUCCESS',
  transactions_fetched: 10,
  transactions_imported: 10,
  transactions_skipped: 0,
  error_message: null,
  started_at: '2026-09-29T10:05:00Z',
  completed_at: '2026-09-29T10:05:02Z',
  created_at: '2026-09-29T10:05:02Z',
}

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={testQueryClient}>
      <BrowserRouter>
        <AuthProvider>{ui}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  )
}

describe('Phase 9B - Account Aggregator (AA) Sandbox Integration Frontend Suite', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-auth-token')
    vi.restoreAllMocks()
    globalQueryClient.clear()
    localStorage.clear()

    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [],
      total_connected_balance: '0.00',
      total_accounts: 0,
    })
  })

  it('1. opens the Connect Bank Account modal with AA Sandbox selected by default', async () => {
    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No connected bank accounts/i)).toBeInTheDocument()
    })

    // Click header Connect Bank Account button
    const openModalBtn = screen.getByRole('button', { name: /^Connect Bank Account$/i })
    fireEvent.click(openModalBtn)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(/^Account Aggregator Sandbox$/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Setu \/ RBI AA Standard/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Personal Finance Management/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Authorize in AA Sandbox/i })).toBeInTheDocument()
  })

  it('2. allows switching provider selection between Setu AA and Quick Demo Bank', async () => {
    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No connected bank accounts/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Connect Bank Account$/i }))

    const dialog = screen.getByRole('dialog')
    // Switch to Quick Demo Bank
    const demoCard = within(dialog).getByText(/Quick Demo Student Bank/i)
    fireEvent.click(demoCard)

    expect(within(dialog).getByRole('button', { name: /^Connect Demo Bank$/i })).toBeInTheDocument()

    // Switch back to Setu AA
    const aaCard = within(dialog).getByText(/^Account Aggregator Sandbox$/i)
    fireEvent.click(aaCard)

    expect(within(dialog).getByRole('button', { name: /Authorize in AA Sandbox/i })).toBeInTheDocument()
  })

  it('3. completes the AA Sandbox authorization flow and updates the account list', async () => {
    const initiateSpy = vi.spyOn(accountService, 'initiateConsent').mockResolvedValue({
      consent_id: 'setu_consent_1_1727618000',
      authorization_url: 'http://localhost:5173/connected-accounts?consent_id=setu_consent_1_1727618000',
      state: 'mock_state_token.signature',
      status: 'PENDING',
      provider: 'setu_aa',
    })

    const callbackSpy = vi.spyOn(accountService, 'handleConsentCallback').mockResolvedValue({
      success: true,
      message: 'Account Aggregator sandbox consent approved and account linked!',
      accounts: [mockAccountAA],
      status: 'ACTIVE',
      sync_result: mockSyncRunAA,
    })

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No connected bank accounts/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Connect Bank Account$/i }))

    const authorizeBtn = screen.getByRole('button', { name: /Authorize in AA Sandbox/i })
    fireEvent.click(authorizeBtn)

    await waitFor(() => {
      expect(initiateSpy).toHaveBeenCalledWith({
        provider: 'setu_aa',
        customer_identifier: 'student@setu',
        redirect_url: expect.stringContaining('/connected-accounts'),
      })
      expect(callbackSpy).toHaveBeenCalledWith({
        consent_id: 'setu_consent_1_1727618000',
        state: 'mock_state_token.signature',
        status: 'ACTIVE',
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/Account Aggregator sandbox consent approved/i)).toBeInTheDocument()
    })
  })

  it('4. displays error message when AA consent authorization fails', async () => {
    vi.spyOn(accountService, 'initiateConsent').mockRejectedValue(
      new Error('Setu AA Sandbox is temporarily unreachable'),
    )

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No connected bank accounts/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Connect Bank Account$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Authorize in AA Sandbox/i }))

    await waitFor(() => {
      expect(screen.getByText(/Setu AA Sandbox is temporarily unreachable/i)).toBeInTheDocument()
    })
  })

  it('5. renders active AA account card with AA Sandbox badge and sync capabilities', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountAA],
      total_connected_balance: '18450.75',
      total_accounts: 1,
    })

    const syncSpy = vi.spyOn(accountService, 'syncAccount').mockResolvedValue(mockSyncRunAA)

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText('State Bank of India (Setu AA Sandbox)')).toBeInTheDocument()
    })

    expect(screen.getByText('AA Sandbox')).toBeInTheDocument()
    expect(screen.getByText(/••••9841/i)).toBeInTheDocument()
    expect(screen.getAllByText(/₹18,450.75/i).length).toBeGreaterThanOrEqual(1)

    // Trigger Sync Now
    const syncBtn = screen.getByRole('button', { name: /Sync Now/i })
    fireEvent.click(syncBtn)

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledWith(201)
      expect(screen.getByText(/Sync completed: 10 imported, 0 duplicates skipped/i)).toBeInTheDocument()
    })
  })

  it('6. handles account disconnection and revokes consent', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountAA],
      total_connected_balance: '18450.75',
      total_accounts: 1,
    })

    const disconnectSpy = vi.spyOn(accountService, 'disconnectAccount').mockResolvedValue({
      success: true,
      message: 'Account disconnected and Account Aggregator consent revoked.',
      account: { ...mockAccountAA, status: 'DISCONNECTED' },
    })

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText('State Bank of India (Setu AA Sandbox)')).toBeInTheDocument()
    })

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i })
    fireEvent.click(disconnectBtn)

    await waitFor(() => {
      expect(disconnectSpy).toHaveBeenCalledWith(201)
      expect(screen.getByText(/Account disconnected and Account Aggregator consent revoked/i)).toBeInTheDocument()
    })
  })
})
