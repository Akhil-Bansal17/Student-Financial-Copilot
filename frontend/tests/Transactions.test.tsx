import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ActivityPage } from '@/pages/ActivityPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionFormSheet } from '@/components/transactions/TransactionFormSheet'
import { transactionService } from '@/services/transactionService'
import { authService, tokenStorage } from '@/services/authService'
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

const mockExpenseTx: Transaction = {
  id: 10,
  user_id: 1,
  transaction_type: 'expense',
  amount: '249.00',
  category: 'Food',
  description: 'Campus Canteen Lunch',
  payment_method: 'UPI',
  transaction_date: '2026-09-23T12:00:00Z',
  created_at: '2026-09-23T12:00:00Z',
  updated_at: '2026-09-23T12:00:00Z',
}

const mockIncomeTx: Transaction = {
  id: 11,
  user_id: 1,
  transaction_type: 'income',
  amount: '3000.00',
  category: 'Pocket Money',
  description: 'Allowance from Dad',
  payment_method: 'Bank Transfer',
  transaction_date: '2026-09-22T10:00:00Z',
  created_at: '2026-09-22T10:00:00Z',
  updated_at: '2026-09-22T10:00:00Z',
}

const mockSummary: FinancialSummaryResponse = {
  starting_balance: '1500.00',
  total_income: '3000.00',
  total_expenses: '249.00',
  current_balance: '4251.00',
  currency: 'INR',
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Phase 2 - Transactions Frontend Suite', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-jwt-token')
    vi.restoreAllMocks()
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
  })

  describe('1. TransactionFormSheet', () => {
    it('renders form controls and defaults to expense mode', () => {
      renderWithProviders(
        <TransactionFormSheet open={true} onOpenChange={() => {}} defaultType="expense" />
      )

      expect(screen.getByRole('heading', { name: /Add Transaction/i })).toBeInTheDocument()
      expect(screen.getByText('Expense')).toBeInTheDocument()
      expect(screen.getByText('Income')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument()
      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Transport')).toBeInTheDocument()
      expect(screen.getByText('UPI')).toBeInTheDocument()
    })

    it('switches between Expense and Income modes and updates category chips', () => {
      renderWithProviders(
        <TransactionFormSheet open={true} onOpenChange={() => {}} defaultType="expense" />
      )

      // In expense mode, Food and Transport are visible
      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Transport')).toBeInTheDocument()

      // Click Income tab
      fireEvent.click(screen.getByRole('button', { name: /Income/i }))

      // In income mode, Pocket Money and Salary are visible and Transport is not
      expect(screen.getByText('Pocket Money')).toBeInTheDocument()
      expect(screen.getByText('Salary')).toBeInTheDocument()
      expect(screen.queryByText('Transport')).toBeNull()
    })

    it('validates amount: rejects empty or non-positive amounts', async () => {
      renderWithProviders(
        <TransactionFormSheet open={true} onOpenChange={() => {}} defaultType="expense" />
      )

      const submitBtn = screen.getByRole('button', { name: /Add Record/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText(/Please enter an amount/i)).toBeInTheDocument()
      })

      // Enter zero amount
      const amountInput = screen.getByPlaceholderText('0.00')
      fireEvent.change(amountInput, { target: { value: '0' } })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText(/Amount must be greater than zero/i)).toBeInTheDocument()
      })
    })

    it('submits valid transaction data and calls createTransaction', async () => {
      const createSpy = vi.spyOn(transactionService, 'createTransaction').mockResolvedValue(mockExpenseTx)
      const onOpenChange = vi.fn()

      renderWithProviders(
        <TransactionFormSheet open={true} onOpenChange={onOpenChange} defaultType="expense" />
      )

      const amountInput = screen.getByPlaceholderText('0.00')
      fireEvent.change(amountInput, { target: { value: '249.00' } })

      // Select category
      fireEvent.click(screen.getByText('Food'))

      // Select payment method
      fireEvent.click(screen.getByText('UPI'))

      // Fill optional description
      const descInput = screen.getByPlaceholderText(/Canteen lunch/i)
      fireEvent.change(descInput, { target: { value: 'Campus Canteen Lunch' } })

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Add Record/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            transaction_type: 'expense',
            amount: '249.00',
            category: 'Food',
            payment_method: 'UPI',
            description: 'Campus Canteen Lunch',
          })
        )
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('2. ActivityPage', () => {
    it('displays empty state when user has no transactions', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText(/No transactions yet/i)).toBeInTheDocument()
      })
    })

    it('displays list of transactions with correct type color and formatted INR', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockExpenseTx, mockIncomeTx],
        total: 2,
        limit: 20,
        offset: 0,
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Campus Canteen Lunch')).toBeInTheDocument()
        expect(screen.getByText('Allowance from Dad')).toBeInTheDocument()
      })

      // Check formatted currency
      expect(screen.getByText('-₹249.00')).toBeInTheDocument()
      expect(screen.getByText('+₹3,000.00')).toBeInTheDocument()
    })

    it('handles delete confirmation dialog and calls deleteTransaction', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockExpenseTx],
        total: 1,
        limit: 20,
        offset: 0,
      })
      const deleteSpy = vi.spyOn(transactionService, 'deleteTransaction').mockResolvedValue({
        success: true,
        message: 'Transaction deleted successfully',
      })

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText('Campus Canteen Lunch')).toBeInTheDocument()
      })

      // Click trash delete icon
      const deleteIconBtn = screen.getByLabelText(/Delete Food transaction/i)
      fireEvent.click(deleteIconBtn)

      // Confirm button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }))

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(10)
      })
    })

    it('displays error state with retry button if API fails', async () => {
      vi.spyOn(transactionService, 'getTransactions').mockRejectedValue(new Error('Network error'))

      renderWithProviders(<ActivityPage />)

      await waitFor(() => {
        expect(screen.getByText(/Could not load transactions/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
      })
    })
  })

  describe('3. DashboardPage', () => {
    it('renders real summary: Current Balance, Starting Balance, Income, Spent', async () => {
      vi.spyOn(transactionService, 'getSummary').mockResolvedValue(mockSummary)
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [mockExpenseTx, mockIncomeTx],
        total: 2,
        limit: 5,
        offset: 0,
      })

      renderWithProviders(<DashboardPage />)

      // Check Current Balance
      await waitFor(() => {
        expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
        expect(screen.getAllByText('₹4,251.00').length).toBeGreaterThanOrEqual(1)
      })

      // Check starting, income, spent metrics
      expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('₹3,000.00').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('₹249.00').length).toBeGreaterThanOrEqual(1)

      // Check recent activity items
      expect(screen.getByText('Campus Canteen Lunch')).toBeInTheDocument()
      expect(screen.getByText('Allowance from Dad')).toBeInTheDocument()
    })

    it('renders clean zero states (₹0.00) when summary is empty and no transactions exist', async () => {
      vi.spyOn(transactionService, 'getSummary').mockResolvedValue({
        starting_balance: '0.00',
        total_income: '0.00',
        total_expenses: '0.00',
        current_balance: '0.00',
        currency: 'INR',
      })
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [],
        total: 0,
        limit: 5,
        offset: 0,
      })

      renderWithProviders(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
      })

      // Zero balance amounts
      const zeroAmounts = screen.getAllByText('₹0.00')
      expect(zeroAmounts.length).toBeGreaterThanOrEqual(1)

      // Clean empty recent transactions state
      expect(screen.getByText(/No recent transactions yet/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Add your first transaction/i })).toBeInTheDocument()
    })

    it('opens TransactionFormSheet when Add Transaction button is clicked', async () => {
      vi.spyOn(transactionService, 'getSummary').mockResolvedValue(mockSummary)
      vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
        items: [],
        total: 0,
        limit: 5,
        offset: 0,
      })

      renderWithProviders(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
      })

      const addBtn = screen.getByRole('button', { name: /Add Transaction/i })
      fireEvent.click(addBtn)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Add Transaction/i })).toBeInTheDocument()
      })
    })
  })
})
