import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { RecurringPage } from '@/pages/RecurringPage'
import { RecurringSummaryBanner } from '@/components/recurring/RecurringSummaryBanner'
import { RecurringExpenseCard } from '@/components/recurring/RecurringExpenseCard'
import { RecurringDetailDrawer } from '@/components/recurring/RecurringDetailDrawer'
import { RecurringEmptyState } from '@/components/recurring/RecurringEmptyState'
import { DashboardRecurringPreview } from '@/components/recurring/DashboardRecurringPreview'
import { CategoryBudgetCard } from '@/components/budgets/CategoryBudgetCard'
import { recurringService } from '@/services/recurringService'
import { authService, tokenStorage } from '@/services/authService'
import type {
  RecurringExpense,
  RecurringSummary,
  RecurringExpenseDetail,
} from '@/types/recurring'
import type { BudgetCategorySummary } from '@/types/budget'
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

const mockExpenseNetflix: RecurringExpense = {
  id: 1,
  user_id: 1,
  merchant: 'Netflix India',
  normalized_merchant: 'netflix',
  category: 'Bills',
  recurring_type: 'SUBSCRIPTION',
  frequency: 'MONTHLY',
  is_variable_amount: false,
  confidence: 'HIGH',
  status: 'ACTIVE',
  average_amount: '549.00',
  latest_amount: '549.00',
  previous_amount: '499.00',
  min_amount: '499.00',
  max_amount: '549.00',
  amount_change: '50.00',
  amount_change_percentage: '10.02',
  occurrence_count: 4,
  last_occurrence_date: '2026-09-15T00:00:00Z',
  next_expected_date: '2026-10-15T00:00:00Z',
  notes: 'Standard 1080p plan',
  created_at: '2026-06-15T00:00:00Z',
  updated_at: '2026-09-15T00:00:00Z',
}

const mockExpenseWifi: RecurringExpense = {
  id: 2,
  user_id: 1,
  merchant: 'Airtel Broadband',
  normalized_merchant: 'airtel broadband',
  category: 'Bills',
  recurring_type: 'RECURRING_BILL',
  frequency: 'MONTHLY',
  is_variable_amount: false,
  confidence: 'HIGH',
  status: 'ACTIVE',
  average_amount: '699.00',
  latest_amount: '699.00',
  previous_amount: null,
  min_amount: '699.00',
  max_amount: '699.00',
  amount_change: null,
  amount_change_percentage: null,
  occurrence_count: 5,
  last_occurrence_date: '2026-09-10T00:00:00Z',
  next_expected_date: '2026-10-10T00:00:00Z',
  notes: 'Hostel WiFi split with roomie',
  created_at: '2026-05-10T00:00:00Z',
  updated_at: '2026-09-10T00:00:00Z',
}

const mockExpenseMess: RecurringExpense = {
  id: 3,
  user_id: 1,
  merchant: 'Campus Mess Committee',
  normalized_merchant: 'campus mess',
  category: 'Food',
  recurring_type: 'RECURRING_EXPENSE',
  frequency: 'MONTHLY',
  is_variable_amount: true,
  confidence: 'MEDIUM',
  status: 'OVERDUE_EXPECTED',
  average_amount: '3200.00',
  latest_amount: '3400.00',
  previous_amount: '3100.00',
  min_amount: '3000.00',
  max_amount: '3400.00',
  amount_change: '300.00',
  amount_change_percentage: '9.68',
  occurrence_count: 3,
  last_occurrence_date: '2026-08-25T00:00:00Z',
  next_expected_date: '2026-09-25T00:00:00Z',
  notes: 'Monthly mess rebate applied',
  created_at: '2026-06-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
}

const mockSummary: RecurringSummary = {
  total_monthly_recurring_spend: '4648.00',
  subscription_count: 1,
  recurring_expense_count: 2,
  fixed_recurring_spend: '1248.00',
  variable_recurring_spend: '3400.00',
  subscription_monthly_spend: '549.00',
  bill_monthly_spend: '699.00',
  other_monthly_spend: '3400.00',
  upcoming_payments: [mockExpenseWifi, mockExpenseNetflix],
  recently_changed: [mockExpenseNetflix, mockExpenseMess],
  needs_attention: [mockExpenseMess],
  total_detected_count: 3,
}

const mockDetail: RecurringExpenseDetail = {
  recurring: mockExpenseNetflix,
  history: [
    {
      id: 101,
      user_id: 1,
      transaction_type: 'expense',
      amount: '549.00',
      category: 'Bills',
      merchant: 'Netflix India',
      payment_method: 'Credit Card',
      transaction_date: '2026-09-15T00:00:00Z',
      description: 'Netflix Monthly Renewal',
      created_at: '2026-09-15T00:00:00Z',
      updated_at: '2026-09-15T00:00:00Z',
    },
    {
      id: 102,
      user_id: 1,
      transaction_type: 'expense',
      amount: '499.00',
      category: 'Bills',
      merchant: 'Netflix India',
      payment_method: 'Credit Card',
      transaction_date: '2026-08-15T00:00:00Z',
      description: 'Netflix Monthly Renewal',
      created_at: '2026-08-15T00:00:00Z',
      updated_at: '2026-08-15T00:00:00Z',
    },
  ],
  user_preference: {
    id: 1,
    user_id: 1,
    normalized_merchant: 'netflix',
    preference_type: 'SUBSCRIPTION',
    created_at: '2026-06-15T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
  },
}

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('Phase 12 — Recurring Expense & Subscription Intelligence Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(tokenStorage, 'getToken').mockReturnValue('fake-jwt-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(recurringService, 'getSummary').mockResolvedValue(mockSummary)
    vi.spyOn(recurringService, 'getRecurringExpenses').mockResolvedValue([
      mockExpenseNetflix,
      mockExpenseWifi,
      mockExpenseMess,
    ])
    vi.spyOn(recurringService, 'getRecurringDetail').mockResolvedValue(mockDetail)
    vi.spyOn(recurringService, 'detectRecurring').mockResolvedValue([
      mockExpenseNetflix,
      mockExpenseWifi,
    ])
    vi.spyOn(recurringService, 'updateRecurringExpense').mockResolvedValue(mockExpenseNetflix)
    vi.spyOn(recurringService, 'ignoreRecurringExpense').mockResolvedValue({
      ...mockExpenseNetflix,
      status: 'USER_IGNORED',
    })
  })

  describe('1. RecurringSummaryBanner', () => {
    it('renders committed monthly spend and fixed vs variable breakdown', () => {
      renderWithProviders(
        <RecurringSummaryBanner
          summary={mockSummary}
          isLoading={false}
          onDetect={vi.fn()}
          isDetecting={false}
        />
      )

      expect(screen.getByText('Committed Monthly Spend')).toBeInTheDocument()
      expect(screen.getByText(/₹4,648/)).toBeInTheDocument()
      expect(screen.getByText(/month committed/)).toBeInTheDocument()
      expect(screen.getByText(/Fixed: ₹1,248/)).toBeInTheDocument()
      expect(screen.getByText(/Variable: ₹3,400/)).toBeInTheDocument()
      expect(screen.getByText('Subscriptions')).toBeInTheDocument()
      expect(screen.getByText('Recurring Bills')).toBeInTheDocument()
      expect(screen.getByText('1 active')).toBeInTheDocument()
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })

    it('triggers detect callback when Detect Recurring button is clicked', () => {
      const handleDetect = vi.fn()
      renderWithProviders(
        <RecurringSummaryBanner
          summary={mockSummary}
          isLoading={false}
          onDetect={handleDetect}
          isDetecting={false}
        />
      )

      const detectBtn = screen.getByRole('button', { name: /Detect Recurring/i })
      fireEvent.click(detectBtn)
      expect(handleDetect).toHaveBeenCalledTimes(1)
    })
  })

  describe('2. RecurringExpenseCard', () => {
    it('renders merchant name, subscription badge, price change, and next renewal', () => {
      const handleClick = vi.fn()
      renderWithProviders(
        <RecurringExpenseCard expense={mockExpenseNetflix} onClick={handleClick} />
      )

      expect(screen.getByText('Netflix India')).toBeInTheDocument()
      expect(screen.getByText('Subscription')).toBeInTheDocument()
      expect(screen.getByText('monthly')).toBeInTheDocument()
      expect(screen.getByText(/\+₹50.*10\.0%/)).toBeInTheDocument()
      expect(screen.getByText(/4 past payments/)).toBeInTheDocument()

      fireEvent.click(screen.getByText('Netflix India'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders overdue warning tag for overdue expected expenses', () => {
      renderWithProviders(
        <RecurringExpenseCard expense={mockExpenseMess} onClick={vi.fn()} />
      )

      expect(screen.getByText('Campus Mess Committee')).toBeInTheDocument()
      expect(screen.getByText('Expected / Overdue')).toBeInTheDocument()
      expect(screen.getByText('Variable')).toBeInTheDocument()
    })
  })

  describe('3. RecurringDetailDrawer', () => {
    it('renders detail modal with past payment history and classification actions', async () => {
      renderWithProviders(
        <RecurringDetailDrawer
          expense={mockExpenseNetflix}
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Payment Breakdown')).toBeInTheDocument()
        expect(screen.getAllByText('Netflix Monthly Renewal')).toHaveLength(2)
      })

      expect(screen.getByText('HIGH Confidence Detection')).toBeInTheDocument()
      expect(screen.getByText('4 times')).toBeInTheDocument()
      expect(screen.getByText(/Price increased/)).toBeInTheDocument()
      expect(screen.getByText(/Payment History/)).toBeInTheDocument()
      expect(screen.getByText('Not Recurring (Ignore)')).toBeInTheDocument()
    })

    it('calls ignoreRecurringExpense when Not Recurring (Ignore) is clicked', async () => {
      const ignoreSpy = vi.spyOn(recurringService, 'ignoreRecurringExpense')
      renderWithProviders(
        <RecurringDetailDrawer
          expense={mockExpenseNetflix}
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Not Recurring (Ignore)')).toBeInTheDocument()
      })

      const ignoreBtn = screen.getByText('Not Recurring (Ignore)')
      fireEvent.click(ignoreBtn)

      await waitFor(() => {
        expect(ignoreSpy).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('4. RecurringEmptyState', () => {
    it('displays educational guidance and scan button', () => {
      const handleDetect = vi.fn()
      renderWithProviders(
        <RecurringEmptyState onDetect={handleDetect} isDetecting={false} />
      )

      expect(screen.getByText('No recurring expenses detected yet')).toBeInTheDocument()
      expect(screen.getByText('Deterministic')).toBeInTheDocument()
      expect(screen.getByText('Price Tracking')).toBeInTheDocument()
      expect(screen.getByText('Due Forecasts')).toBeInTheDocument()

      const detectBtn = screen.getByRole('button', { name: /Run Pattern Detection/i })
      fireEvent.click(detectBtn)
      expect(handleDetect).toHaveBeenCalledTimes(1)
    })
  })

  describe('5. RecurringPage Component', () => {
    it('renders recurring list and filters by tab', async () => {
      renderWithProviders(<RecurringPage />)

      await waitFor(() => {
        expect(screen.getByText('Netflix India')).toBeInTheDocument()
      })

      // All items initially
      expect(screen.getByText('Airtel Broadband')).toBeInTheDocument()
      expect(screen.getByText('Campus Mess Committee')).toBeInTheDocument()

      // Switch to Subscriptions tab
      const subsTab = screen.getByRole('button', { name: /Subscriptions/i })
      fireEvent.click(subsTab)

      expect(screen.getByText('Netflix India')).toBeInTheDocument()
      expect(screen.queryByText('Airtel Broadband')).not.toBeInTheDocument()

      // Switch to Price Changes tab
      const priceChangesTab = screen.getByRole('button', { name: /Price Changes/i })
      fireEvent.click(priceChangesTab)

      expect(screen.getByText('Netflix India')).toBeInTheDocument()
      expect(screen.getByText('Campus Mess Committee')).toBeInTheDocument()
      expect(screen.queryByText('Airtel Broadband')).not.toBeInTheDocument()
    })

    it('filters items by search input', async () => {
      renderWithProviders(<RecurringPage />)

      await waitFor(() => {
        expect(screen.getByText('Netflix India')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search by merchant/i)
      fireEvent.change(searchInput, { target: { value: 'Airtel' } })

      expect(screen.getByText('Airtel Broadband')).toBeInTheDocument()
      expect(screen.queryByText('Netflix India')).not.toBeInTheDocument()
    })
  })

  describe('6. DashboardRecurringPreview', () => {
    it('renders recurring commitments card on dashboard with next due date', async () => {
      renderWithProviders(<DashboardRecurringPreview />)

      await waitFor(() => {
        expect(screen.getByText('Recurring Commitments')).toBeInTheDocument()
      })

      expect(screen.getByText('Next Due')).toBeInTheDocument()
      expect(screen.getByText('Airtel Broadband')).toBeInTheDocument()
      expect(screen.getByText('1 active')).toBeInTheDocument()
    })
  })

  describe('7. CategoryBudgetCard Recurring Integration', () => {
    it('renders committed recurring indicator when recurring_amount is provided', () => {
      const mockCategorySummary: BudgetCategorySummary = {
        id: 1,
        category: 'Bills',
        budget: '2000.00',
        spent: '1248.00',
        remaining: '752.00',
        utilization: '62.4',
        over_budget: false,
        recurring_amount: '1248.00',
      }

      renderWithProviders(
        <CategoryBudgetCard
          summary={mockCategorySummary}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByText('Committed recurring')).toBeInTheDocument()
      expect(screen.getAllByText('₹1,248.00')).toHaveLength(2)
    })
  })
})
