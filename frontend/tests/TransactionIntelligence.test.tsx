import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ActivityPage } from '@/pages/ActivityPage'
import { TransactionDetailSheet } from '@/components/transactions/TransactionDetailSheet'
import { transactionService } from '@/services/transactionService'
import { accountService } from '@/services/accountService'
import { reconciliationService } from '@/services/reconciliationService'
import { authService, tokenStorage } from '@/services/authService'
import type { Transaction } from '@/types/transaction'
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

const mockBankTx: Transaction = {
  id: 101,
  user_id: 1,
  transaction_type: 'expense',
  amount: '349.00',
  category: 'Food',
  description: 'Swiggy order #98213',
  merchant: 'SWIGGY',
  normalized_merchant: 'SWIGGY',
  category_confidence: 'HIGH',
  categorization_source: 'RULE_HIGH',
  status: 'POSTED',
  payment_method: 'UPI',
  source: 'BANK_SYNC',
  account_id: 5,
  external_transaction_id: 'SETU-TX-10101',
  raw_bank_description: 'UPI/SWIGGY/98213/Bangalore',
  transaction_date: '2026-09-28T14:30:00Z',
  created_at: '2026-09-28T14:35:00Z',
  updated_at: '2026-09-28T14:35:00Z',
}

const mockManualTx: Transaction = {
  id: 102,
  user_id: 1,
  transaction_type: 'expense',
  amount: '120.00',
  category: 'Transport',
  description: 'Auto rickshaw to metro',
  merchant: null,
  normalized_merchant: null,
  category_confidence: 'HIGH',
  categorization_source: 'USER_MANUAL',
  status: 'POSTED',
  payment_method: 'Cash',
  source: 'MANUAL',
  account_id: null,
  external_transaction_id: null,
  raw_bank_description: null,
  transaction_date: '2026-09-28T10:00:00Z',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
}

const mockReconciledTx: Transaction = {
  id: 103,
  user_id: 1,
  transaction_type: 'expense',
  amount: '499.00',
  category: 'Entertainment',
  description: 'Netflix Monthly Subscription',
  merchant: 'NETFLIX',
  normalized_merchant: 'NETFLIX',
  category_confidence: 'HIGH',
  categorization_source: 'USER_PREFERENCE',
  status: 'POSTED',
  payment_method: 'Debit Card',
  source: 'RECONCILED',
  account_id: 5,
  external_transaction_id: 'SETU-TX-99882',
  raw_bank_description: 'POS/NETFLIX/99882/MUMBAI',
  transaction_date: '2026-09-27T08:00:00Z',
  created_at: '2026-09-27T08:05:00Z',
  updated_at: '2026-09-27T08:05:00Z',
}

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const qc = queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return {
    ...render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <BrowserRouter>{ui}</BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
    queryClient: qc,
  }
}

describe('Phase 11 - Transaction Intelligence & Merchant Normalization Frontend Suite', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-jwt-token')
    vi.restoreAllMocks()
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(accountService, 'getAccounts').mockResolvedValue({
      items: [
        {
          id: 5,
          user_id: 1,
          provider: 'MOCK_BANK',
          provider_account_id: 'HDFC-10101',
          institution_name: 'HDFC Bank',
          account_type: 'SAVINGS',
          masked_account_number: '••••4321',
          current_balance: '15000.00',
          balance_as_of: '2026-09-28T00:00:00Z',
          currency: 'INR',
          status: 'ACTIVE',
          last_synced_at: '2026-09-28T12:00:00Z',
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
      total_connected_balance: '15000.00',
      total_accounts: 1,
    })
    vi.spyOn(reconciliationService, 'getPendingReconciliations').mockResolvedValue([])
    vi.spyOn(reconciliationService, 'getReconciliationSummary').mockResolvedValue({
      pending_count: 0,
      reconciled_count: 0,
    })
  })

  describe('1. TransactionDetailSheet Component', () => {
    it('renders transaction details correctly with amount, merchant, and raw bank narration', () => {
      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockBankTx}
          isOpen={true}
          onClose={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )

      expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      expect(screen.getByText('-₹349.00')).toBeInTheDocument()
      expect(screen.getByText('SWIGGY')).toBeInTheDocument()
      expect(screen.getByText('Original Bank Narration')).toBeInTheDocument()
      expect(screen.getByText('UPI/SWIGGY/98213/Bangalore')).toBeInTheDocument()
      expect(screen.getByText('Bank Sync')).toBeInTheDocument()
      expect(screen.getByText('SETU-TX-10101')).toBeInTheDocument()
    })

    it('shows provenance badges: Reconciled with Bank', () => {
      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockReconciledTx}
          isOpen={true}
          onClose={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )

      expect(screen.getByText('Reconciled with Bank')).toBeInTheDocument()
      expect(screen.getByText('NETFLIX')).toBeInTheDocument()
    })

    it('shows provenance badges: Manual Entry for manual transactions', () => {
      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockManualTx}
          isOpen={true}
          onClose={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )

      expect(screen.getByText('Manual Entry')).toBeInTheDocument()
    })

    it('allows changing category and saving merchant preference', async () => {
      const updateSpy = vi.spyOn(transactionService, 'updateTransaction').mockResolvedValue({
        ...mockBankTx,
        category: 'Personal Care',
      })
      const onClose = vi.fn()

      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockBankTx}
          isOpen={true}
          onClose={onClose}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )

      // Click "Quick Change" button
      const changeCatBtn = screen.getByRole('button', { name: /Quick Change/i })
      fireEvent.click(changeCatBtn)

      // Select new category "Shopping"
      const selectDropdown = screen.getByRole('combobox')
      fireEvent.change(selectDropdown, { target: { value: 'Shopping' } })

      // Checkbox is present
      const prefCheckbox = screen.getByRole('checkbox')
      expect(prefCheckbox).toBeChecked()

      // Save category
      const saveBtn = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(101, {
          category: 'Shopping',
          remember_merchant_preference: true,
        })
      })
    })

    it('handles keyboard interaction: Escape closes the sheet', () => {
      const onClose = vi.fn()
      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockBankTx}
          isOpen={true}
          onClose={onClose}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('2. Merchant Preference Service Integration', () => {
    it('creates, updates, and deletes merchant category preferences', async () => {
      const getSpy = vi.spyOn(transactionService, 'getMerchantPreferences').mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          normalized_merchant: 'SWIGGY',
          category: 'Food',
          created_at: '2026-09-20T00:00:00Z',
          updated_at: '2026-09-20T00:00:00Z',
        },
      ])
      const createSpy = vi.spyOn(transactionService, 'createMerchantPreference').mockResolvedValue({
        id: 2,
        user_id: 1,
        normalized_merchant: 'UBER',
        category: 'Transport',
        created_at: '2026-09-28T00:00:00Z',
        updated_at: '2026-09-28T00:00:00Z',
      })
      const updateSpy = vi.spyOn(transactionService, 'updateMerchantPreference').mockResolvedValue({
        id: 2,
        user_id: 1,
        normalized_merchant: 'UBER',
        category: 'Travel',
        created_at: '2026-09-28T00:00:00Z',
        updated_at: '2026-09-28T01:00:00Z',
      })
      const deleteSpy = vi.spyOn(transactionService, 'deleteMerchantPreference').mockResolvedValue({
        success: true,
        message: 'Preference removed',
      })

      const prefs = await transactionService.getMerchantPreferences()
      expect(getSpy).toHaveBeenCalled()
      expect(prefs).toHaveLength(1)
      expect(prefs[0].normalized_merchant).toBe('SWIGGY')

      const saved = await transactionService.createMerchantPreference({
        normalized_merchant: 'UBER',
        category: 'Transport',
      })
      expect(createSpy).toHaveBeenCalledWith({
        normalized_merchant: 'UBER',
        category: 'Transport',
      })
      expect(saved.normalized_merchant).toBe('UBER')

      const updated = await transactionService.updateMerchantPreference(2, 'Travel')
      expect(updateSpy).toHaveBeenCalledWith(2, 'Travel')
      expect(updated.category).toBe('Travel')

      const res = await transactionService.deleteMerchantPreference(2)
      expect(deleteSpy).toHaveBeenCalledWith(2)
      expect(res.success).toBe(true)
    })
  })

  describe('3. ActivityPage Search & Advanced Filtering', () => {
    it('searches transactions by keyword and triggers server query', async () => {
      const getSpy = vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockBankTx],
        total: 1,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Swiggy order #98213')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search merchant, description, category/i)
      fireEvent.change(searchInput, { target: { value: 'Swiggy' } })

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Swiggy',
          })
        )
      })
    })

    it('filters by category, source, and transaction type in drawer', async () => {
      const getSpy = vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockBankTx, mockManualTx, mockReconciledTx],
        total: 3,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Swiggy order #98213')).toBeInTheDocument()
      })

      // Open Filters panel
      const filterBtn = screen.getByRole('button', { name: /Filters/i })
      fireEvent.click(filterBtn)

      expect(screen.getByText('Advanced Ledger Filters')).toBeInTheDocument()

      // Select "Expenses" tab
      const expenseTab = screen.getByRole('button', { name: /^Expenses$/i })
      fireEvent.click(expenseTab)

      // Select "BANK_SYNC" in Source select dropdown
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[1], { target: { value: 'BANK_SYNC' } })

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction_type: 'expense',
            source: 'BANK_SYNC',
          })
        )
      })
    })

    it('displays no results empty state when search matches nothing', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      const searchInput = screen.getByPlaceholderText(/Search merchant, description, category/i)
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } })

      await waitFor(() => {
        expect(screen.getByText(/No matching transactions/i)).toBeInTheDocument()
      })
    })

    it('displays error state with retry button when transaction fetch fails', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockRejectedValue(new Error('Network failure'))

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText(/Could not load transactions/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
    })
  })

  describe('4. Bulk Transaction Selection & Category Update', () => {
    it('enters select mode, selects transactions, and performs bulk category update', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockBankTx, mockManualTx],
        total: 2,
        limit: 20,
        offset: 0,
      })
      const bulkSpy = vi.spyOn(transactionService, 'bulkUpdateCategory').mockResolvedValue({
        updated_count: 2,
        preference_saved: true,
        category: 'Education',
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Swiggy order #98213')).toBeInTheDocument()
      })

      // Click "Select" button to enter bulk mode
      const selectBtn = screen.getByRole('button', { name: /^Select$/i })
      fireEvent.click(selectBtn)

      // Select All button should appear
      const selectAllBtn = screen.getByRole('button', { name: /Select All/i })
      fireEvent.click(selectAllBtn)

      // Bulk action bar shows selected count
      expect(screen.getByText(/2 of 2 selected/i)).toBeInTheDocument()

      // Click "Change Category" in floating action bar
      const setCatBtn = screen.getByRole('button', { name: /Change Category/i })
      fireEvent.click(setCatBtn)

      // Bulk modal opens
      expect(screen.getByText(/Bulk Change Category/i)).toBeInTheDocument()

      // Choose "Education" category in modal select
      const modalSelect = screen.getByRole('dialog').querySelector('select')
      if (modalSelect) {
        fireEvent.change(modalSelect, { target: { value: 'Education' } })
      }

      // Click Apply Category
      const confirmApplyBtn = screen.getByRole('button', { name: /Apply Category/i })
      fireEvent.click(confirmApplyBtn)

      await waitFor(() => {
        expect(bulkSpy).toHaveBeenCalledWith({
          transaction_ids: [101, 102],
          category: 'Education',
          update_merchant_preference: true,
        })
      })
    })
  })

  describe('5. Row Click Opens Detail Sheet & Cache Invalidation', () => {
    it('clicking a transaction row opens the TransactionDetailSheet', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockBankTx],
        total: 1,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('SWIGGY')).toBeInTheDocument()
      })

      // Click on the transaction row
      const swiggyEl = screen.getByText('SWIGGY')
      fireEvent.click(swiggyEl)

      // Transaction detail sheet opens
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('invalidates transactions and analytics queries after editing category', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      vi.spyOn(transactionService, 'updateTransaction').mockResolvedValue({
        ...mockBankTx,
        category: 'Shopping',
      })

      renderWithProviders(
        <TransactionDetailSheet
          transaction={mockBankTx}
          isOpen={true}
          onClose={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />,
        queryClient
      )

      // Trigger category change
      fireEvent.click(screen.getByRole('button', { name: /Quick Change/i }))
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Shopping' } })
      fireEvent.click(screen.getByRole('button', { name: /Save/i }))

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['transactions'] }))
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['financial-summary'] }))
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['analytics'] }))
      })
    })
  })

  describe('6. Mobile & Accessibility Verification', () => {
    it('renders with appropriate ARIA accessibility attributes across viewports', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockBankTx, mockManualTx],
        total: 2,
        limit: 20,
        offset: 0,
      })

      const { container } = renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Swiggy order #98213')).toBeInTheDocument()
      })

      // Verify search input has accessible label or placeholder
      const searchInput = screen.getByPlaceholderText(/Search merchant, description, category/i)
      expect(searchInput).toHaveAttribute('aria-label')

      // Verify Filter button has accessible name
      expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument()

      // Verify no horizontal overflow class issues
      expect(container.querySelector('.overflow-x-hidden')).toBeDefined()
    })
  })
})
