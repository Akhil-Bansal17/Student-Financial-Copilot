import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConnectedAccountsPage } from '@/pages/ConnectedAccountsPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { accountService } from '@/services/accountService'
import { transactionService } from '@/services/transactionService'
import { authService, tokenStorage } from '@/services/authService'
import { queryClient as globalQueryClient } from '@/lib/queryClient'
import type { ConnectedAccount, SyncRun } from '@/types/account'
import type { Transaction, TransactionListResponse } from '@/types/transaction'
import type { User } from '@/types'

const mockUser: User = {
  id: 1,
  email: 'student@campus.edu',
  full_name: 'Aditya Sharma',
  is_active: true,
  onboarding_completed: true,
  created_at: '2026-09-22T00:00:00Z',
  updated_at: '2026-09-22T00:00:00Z',
}

const mockAccountActive: ConnectedAccount = {
  id: 101,
  user_id: 1,
  provider: 'mock_bank',
  provider_account_id: 'mock_acc_1_savings_01',
  institution_name: 'Demo Student Bank (Sandbox)',
  account_type: 'savings',
  masked_account_number: '••••5821',
  currency: 'INR',
  current_balance: '12450.00',
  balance_as_of: '2026-09-29T10:00:00Z',
  status: 'ACTIVE',
  last_synced_at: '2026-09-29T10:05:00Z',
  created_at: '2026-09-29T09:00:00Z',
  updated_at: '2026-09-29T10:05:00Z',
  is_sandbox: true,
}

const mockAccountDisconnected: ConnectedAccount = {
  ...mockAccountActive,
  id: 102,
  status: 'DISCONNECTED',
}

const mockSyncRunSuccess: SyncRun = {
  id: 501,
  user_id: 1,
  account_id: 101,
  provider: 'mock_bank',
  status: 'SUCCESS',
  transactions_fetched: 10,
  transactions_imported: 10,
  transactions_skipped: 0,
  error_message: null,
  started_at: '2026-09-29T10:05:00Z',
  completed_at: '2026-09-29T10:05:02Z',
  created_at: '2026-09-29T10:05:00Z',
}

function renderWithProviders(ui: React.ReactElement, testQueryClient?: QueryClient) {
  const qc =
    testQueryClient ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })

  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>{ui}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Phase 9A - Automated Bank Sync & Connected Accounts Frontend Suite', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-auth-token')
    vi.restoreAllMocks()
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
  })

  // 1 & 2. Empty state rendering and connection action
  it('1. renders empty state when no accounts are linked and allows connecting demo account', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [],
      total_connected_balance: '0.00',
      total_accounts: 0,
    })
    const connectSpy = vi.spyOn(accountService, 'connectMock').mockResolvedValue(mockAccountActive)

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText(/No connected bank accounts/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Account Aggregator Sandbox Architecture/i)).toBeInTheDocument()

    // Find Connect Demo Bank Account button
    const connectBtn = screen.getByRole('button', { name: /Connect Demo Bank Account/i })
    expect(connectBtn).toBeInTheDocument()

    fireEvent.click(connectBtn)

    await waitFor(() => {
      expect(connectSpy).toHaveBeenCalledTimes(1)
    })
  })

  // 3. Active account card rendering
  it('2. renders active connected account details, balance, and badges', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText('Demo Student Bank (Sandbox)')).toBeInTheDocument()
    })

    // Check masked account number and account type
    expect(screen.getByText(/••••5821 ·/i)).toBeInTheDocument()
    expect(screen.getByText(/^savings$/i)).toBeInTheDocument()

    // Check balance display (appears in both aggregate card and account card)
    expect(screen.getAllByText(/₹12,450/i).length).toBeGreaterThanOrEqual(2)

    // Check status badge
    expect(screen.getByText(/^active$/i)).toBeInTheDocument()

    // Check Sync Now and Disconnect buttons
    expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument()
  })

  // 4 & 5 & 10. Sync Now button, feedback notification, and query invalidation
  it('3. triggers automated sync, displays success feedback banner, and invalidates financial caches', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    const syncSpy = vi.spyOn(accountService, 'syncAccount').mockResolvedValue(mockSyncRunSuccess)
    const invalidateSpy = vi.spyOn(globalQueryClient, 'invalidateQueries')

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText('Demo Student Bank (Sandbox)')).toBeInTheDocument()
    })

    const syncBtn = screen.getByRole('button', { name: /Sync Now/i })
    fireEvent.click(syncBtn)

    await waitFor(() => {
      expect(syncSpy).toHaveBeenCalledWith(101)
    })

    await waitFor(() => {
      expect(screen.getByText(/Sync completed: 10 imported, 0 duplicates skipped/i)).toBeInTheDocument()
    })

    // Assert cache invalidation triggered for all dependent queries
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['transactions'] }))
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['financial-summary'] }))
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['analytics'] }))
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['budgets'] }))
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['insights'] }))
  })

  // 6. Sync failure handling
  it('4. displays error message gracefully when provider sync fails', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    vi.spyOn(accountService, 'syncAccount').mockRejectedValue(new Error('Connection to sandbox bank timed out'))

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Sync Now/i }))

    await waitFor(() => {
      expect(screen.getByText(/Connection to sandbox bank timed out/i)).toBeInTheDocument()
    })
  })

  // 7 & 8. Disconnect flow and status update
  it('5. handles account disconnection and revokes consent', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    const disconnectSpy = vi.spyOn(accountService, 'disconnectAccount').mockResolvedValue({
      success: true,
      message: 'Account disconnected successfully',
      account: mockAccountDisconnected,
    })

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }))

    await waitFor(() => {
      expect(disconnectSpy).toHaveBeenCalledWith(101)
    })

    await waitFor(() => {
      expect(screen.getByText(/Account disconnected and Account Aggregator consent revoked/i)).toBeInTheDocument()
    })
  })

  // 9. Sync History audit toggle and panel
  it('6. toggles sync history panel and displays previous audit runs', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    const historySpy = vi.spyOn(accountService, 'getSyncHistory').mockResolvedValue([mockSyncRunSuccess])

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync History/i })).toBeInTheDocument()
    })

    // Click Sync History toggle
    fireEvent.click(screen.getByRole('button', { name: /Sync History/i }))

    await waitFor(() => {
      expect(historySpy).toHaveBeenCalledWith(101, 10)
    })

    await waitFor(() => {
      expect(screen.getByText(/Recent Synchronization Audit Logs/i)).toBeInTheDocument()
      expect(screen.getByText(/10 imported/i)).toBeInTheDocument()
      expect(screen.getByText(/0 skipped/i)).toBeInTheDocument()
    })
  })

  // 9. Transaction provenance in ActivityPage
  it('7. displays Bank Sync vs Manual provenance badges and descriptions on Activity page', async () => {
    const bankTx: Transaction = {
      id: 201,
      user_id: 1,
      transaction_type: 'expense',
      amount: '180.00',
      category: 'Food',
      description: 'Campus Canteen Lunch (Sandbox)',
      payment_method: 'UPI',
      transaction_date: '2026-09-29T12:00:00Z',
      source: 'BANK_SYNC',
      provider: 'mock_bank',
      account_id: 101,
      external_transaction_id: 'mock_tx_demo_001',
      raw_bank_description: 'UPI/CR/82910281/CAMPUS CANTEEN/UTIB000123',
      created_at: '2026-09-29T12:00:00Z',
      updated_at: '2026-09-29T12:00:00Z',
    }

    const manualTx: Transaction = {
      id: 202,
      user_id: 1,
      transaction_type: 'expense',
      amount: '50.00',
      category: 'Food',
      description: 'Canteen Tea',
      payment_method: 'Cash',
      transaction_date: '2026-09-29T11:00:00Z',
      source: 'MANUAL',
      provider: null,
      account_id: null,
      external_transaction_id: null,
      raw_bank_description: null,
      created_at: '2026-09-29T11:00:00Z',
      updated_at: '2026-09-29T11:00:00Z',
    }

    const mockResponse: TransactionListResponse = {
      items: [bankTx, manualTx],
      total: 2,
      limit: 20,
      offset: 0,
    }

    vi.spyOn(transactionService, 'getTransactions').mockResolvedValue(mockResponse)

    renderWithProviders(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('Campus Canteen Lunch (Sandbox)')).toBeInTheDocument()
    })

    // Bank Sync badge must be rendered for bankTx
    expect(screen.getByText('Bank Sync')).toBeInTheDocument()

    // Manual badge must be rendered for manualTx
    expect(screen.getByText('Manual')).toBeInTheDocument()

    // Raw bank narration reference should be present
    expect(screen.getByText('UPI/CR/82910281/CAMPUS CANTEEN/UTIB000123')).toBeInTheDocument()
  })

  // 11. Responsive viewport verification
  it('8. renders ConnectedAccountsPage across viewports without breaking (320px to 1024px)', async () => {
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [mockAccountActive],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    const viewports = [320, 375, 390, 412, 430, 768, 1024]

    for (const width of viewports) {
      window.innerWidth = width
      window.innerHeight = 800
      window.dispatchEvent(new Event('resize'))

      const { unmount } = renderWithProviders(<ConnectedAccountsPage />)

      await waitFor(() => {
        expect(screen.getByText('Connected Accounts')).toBeInTheDocument()
        expect(screen.getByText('Demo Student Bank (Sandbox)')).toBeInTheDocument()
      })

      unmount()
    }
  })
})
