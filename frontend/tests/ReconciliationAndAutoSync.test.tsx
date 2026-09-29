import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ActivityPage } from '@/pages/ActivityPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ConnectedAccountsPage } from '@/pages/ConnectedAccountsPage'
import { reconciliationService } from '@/services/reconciliationService'
import { accountService } from '@/services/accountService'
import { transactionService } from '@/services/transactionService'
import { analyticsService } from '@/services/analyticsService'
import { authService, tokenStorage } from '@/services/authService'
import type { ReconciliationItem, SyncStatusData } from '@/types/reconciliation'
import type { ConnectedAccount } from '@/types/account'
import type { Transaction, FinancialSummaryResponse } from '@/types/transaction'
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

const mockPendingItem: ReconciliationItem = {
  id: 99,
  user_id: 1,
  manual_transaction_id: 10,
  bank_transaction_id: null,
  account_id: 101,
  external_transaction_id: 'SETU-TX-99881',
  status: 'PENDING_REVIEW',
  match_type: 'POSSIBLE_MATCH',
  confidence_score: '0.75',
  match_reasons: ['Amount exact match', 'Transaction on same calendar day'],
  manual_amount: '500.00',
  manual_description: 'Lunch at Cafeteria',
  manual_category: 'Food',
  manual_date: '2026-09-29T13:00:00Z',
  bank_amount: '500.00',
  bank_description: 'SWIGGY BANGALORE IN',
  bank_category: 'Food',
  bank_date: '2026-09-29T13:05:00Z',
  raw_bank_description: 'UPI/SWIGGY/99881/Bangalore',
  reconciled_at: null,
  created_at: '2026-09-29T13:10:00Z',
}

const mockSyncFreshness: SyncStatusData = {
  last_synced_at: '2026-09-29T13:00:00Z',
  sync_status: 'UP_TO_DATE',
  is_stale: false,
  total_connected_accounts: 1,
  total_bank_balance: '12450.00',
  ledger_balance: '12950.00',
  balance_difference: '500.00',
  pending_reconciliations: 1,
}

const mockSummary: FinancialSummaryResponse = {
  starting_balance: '10000.00',
  total_income: '5000.00',
  total_expenses: '2050.00',
  net_cash_flow: '2950.00',
  current_balance: '12950.00',
  income_transaction_count: 1,
  expense_transaction_count: 5,
  currency: 'INR',
}

const mockReconciledTx: Transaction = {
  id: 10,
  user_id: 1,
  transaction_type: 'expense',
  amount: '500.00',
  category: 'Food',
  description: 'Lunch at Cafeteria',
  payment_method: 'UPI',
  transaction_date: '2026-09-29T13:00:00Z',
  source: 'RECONCILED',
  reconciliation_status: 'RECONCILED',
  external_transaction_id: 'SETU-TX-99881',
  raw_bank_description: 'UPI/SWIGGY/99881/Bangalore',
  created_at: '2026-09-29T13:00:00Z',
  updated_at: '2026-09-29T13:10:00Z',
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
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

describe('Phase 10 — Automatic Bank Sync & Financial Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(tokenStorage, 'getToken').mockReturnValue('fake-test-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(transactionService, 'getSummary').mockResolvedValue(mockSummary)
    vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
      items: [mockReconciledTx],
      total: 1,
      limit: 20,
      offset: 0,
    })
    vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue({
      year: 2026,
      month: 9,
      monthly_income: '5000.00',
      monthly_expenses: '2050.00',
      monthly_net_cash_flow: '2950.00',
      transaction_count: 6,
      previous_month_income: '0.00',
      previous_month_expenses: '0.00',
      previous_month_net_cash_flow: '0.00',
      income_change_percentage: null,
      expense_change_percentage: null,
      net_cash_flow_change_percentage: null,
    })
    vi.spyOn(analyticsService, 'getCategories').mockResolvedValue({
      year: 2026,
      month: 9,
      total_expenses: '2050.00',
      items: [],
    })
    vi.spyOn(analyticsService, 'getTrend').mockResolvedValue({
      year: 2026,
      month: 9,
      days: [],
    })
  })

  it('1. ActivityPage displays pending reconciliation possible duplicates', async () => {
    vi.spyOn(reconciliationService, 'getPendingReconciliations').mockResolvedValue([mockPendingItem])

    renderWithProviders(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText(/Possible Duplicate Transactions/i)).toBeInTheDocument()
    })

    expect(screen.getByText('SWIGGY BANGALORE IN')).toBeInTheDocument()
    expect(screen.getAllByText('Lunch at Cafeteria')[0]).toBeInTheDocument()
    expect(screen.getByText(/Amount exact match/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Match/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Keep Separate/i })).toBeInTheDocument()
  })

  it('2. ActivityPage displays Reconciled badge on unified transactions', async () => {
    vi.spyOn(reconciliationService, 'getPendingReconciliations').mockResolvedValue([])

    renderWithProviders(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByText('Reconciled')).toBeInTheDocument()
    })
  })

  it('3. User clicking Match triggers matchReconciliation call', async () => {
    vi.spyOn(reconciliationService, 'getPendingReconciliations').mockResolvedValue([mockPendingItem])
    const matchSpy = vi.spyOn(reconciliationService, 'matchReconciliation').mockResolvedValue({
      ...mockPendingItem,
      status: 'MATCHED',
    })

    renderWithProviders(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Match/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Match/i }))

    await waitFor(() => {
      expect(matchSpy).toHaveBeenCalledWith(99)
    })
  })

  it('4. User clicking Keep Separate triggers keepSeparateReconciliation call', async () => {
    vi.spyOn(reconciliationService, 'getPendingReconciliations').mockResolvedValue([mockPendingItem])
    const keepSpy = vi.spyOn(reconciliationService, 'keepSeparateReconciliation').mockResolvedValue({
      status: 'SEPARATE',
      message: 'Bank transaction imported as genuine entry.',
      transaction_id: 11,
    })

    renderWithProviders(<ActivityPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Keep Separate/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Keep Separate/i }))

    await waitFor(() => {
      expect(keepSpy).toHaveBeenCalledWith(99)
    })
  })

  it('5. DashboardPage displays Connected Bank Sync status and balance reconciliation', async () => {
    vi.spyOn(reconciliationService, 'getSyncFreshnessStatus').mockResolvedValue(mockSyncFreshness)
    vi.spyOn(accountService, 'syncAll').mockResolvedValue([])

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Connected Bank Sync')).toBeInTheDocument()
      expect(screen.getByText('Up to date')).toBeInTheDocument()
      expect(screen.getByText('1 connected')).toBeInTheDocument()
    })

    // Ledger balance and connected bank balance indicators
    expect(screen.getByText('Connected Bank Balance')).toBeInTheDocument()
    expect(screen.getByText('Ledger Balance (Authoritative)')).toBeInTheDocument()
    expect(screen.getByText('Reconciliation Difference')).toBeInTheDocument()
  })

  it('6. DashboardPage displays stale-sync warning when bank data is delayed', async () => {
    vi.spyOn(reconciliationService, 'getSyncFreshnessStatus').mockResolvedValue({
      ...mockSyncFreshness,
      is_stale: true,
      sync_status: 'DELAYED',
    })

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Sync delayed')).toBeInTheDocument()
    })
  })

  it('7. DashboardPage clicking Sync Now calls accountService.syncAll', async () => {
    vi.spyOn(reconciliationService, 'getSyncFreshnessStatus').mockResolvedValue(mockSyncFreshness)
    const syncAllSpy = vi.spyOn(accountService, 'syncAll').mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        account_id: 101,
        provider: 'mock_bank',
        status: 'SUCCESS',
        trigger_type: 'MANUAL',
        transactions_fetched: 5,
        transactions_imported: 2,
        transactions_skipped: 2,
        transactions_reconciled: 1,
        error_message: null,
        started_at: '2026-09-29T14:00:00Z',
        completed_at: '2026-09-29T14:00:02Z',
        created_at: '2026-09-29T14:00:00Z',
      },
    ])

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sync Now/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Sync Now/i }))

    await waitFor(() => {
      expect(syncAllSpy).toHaveBeenCalled()
    })
  })

  it('8. ConnectedAccountsPage shows Auto-Sync Active badge and respects sync lock', async () => {
    const lockedAccount: ConnectedAccount = {
      id: 101,
      user_id: 1,
      provider: 'mock_bank',
      provider_account_id: 'mock_acc_101',
      institution_name: 'Demo Student Bank',
      account_type: 'savings',
      masked_account_number: '••••5821',
      currency: 'INR',
      current_balance: '12450.00',
      balance_as_of: '2026-09-29T10:00:00Z',
      status: 'ACTIVE',
      last_synced_at: '2026-09-29T10:05:00Z',
      created_at: '2026-09-29T09:00:00Z',
      updated_at: '2026-09-29T10:05:00Z',
      auto_sync_enabled: true,
      sync_lock_at: '2026-09-29T10:10:00Z',
    }

    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [lockedAccount],
      total_connected_balance: '12450.00',
      total_accounts: 1,
    })

    renderWithProviders(<ConnectedAccountsPage />)

    await waitFor(() => {
      expect(screen.getByText('Auto-Sync Active')).toBeInTheDocument()
      expect(screen.getByText('Syncing')).toBeInTheDocument()
    })

    // Button should be disabled while lock is held
    const syncButton = screen.getByRole('button', { name: /Syncing.../i })
    expect(syncButton).toBeDisabled()
  })
})
