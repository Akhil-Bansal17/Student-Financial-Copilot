import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { DashboardPage } from '@/pages/DashboardPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { CategorySpendingSection } from '@/components/analytics/CategorySpendingSection'
import { IncomeBreakdownSection } from '@/components/analytics/IncomeBreakdownSection'
import { SpendingTrendSection } from '@/components/analytics/SpendingTrendSection'
import { MonthNavigator } from '@/components/analytics/MonthNavigator'
import { analyticsService } from '@/services/analyticsService'
import { transactionService } from '@/services/transactionService'
import { authService, tokenStorage } from '@/services/authService'
import type {
  FinancialSummaryResponse,
  MonthlyAnalyticsResponse,
  CategorySpendingResponse,
  IncomeCategoryResponse,
  DailyTrendResponse,
} from '@/types/analytics'
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

const mockSummary: FinancialSummaryResponse = {
  starting_balance: '1500.00',
  total_income: '5000.00',
  total_expenses: '1850.00',
  net_cash_flow: '3150.00',
  current_balance: '4650.00',
  income_transaction_count: 2,
  expense_transaction_count: 5,
  currency: 'INR',
}

const mockMonthly: MonthlyAnalyticsResponse = {
  year: 2026,
  month: 9,
  monthly_income: '5000.00',
  monthly_expenses: '1850.00',
  monthly_net_cash_flow: '3150.00',
  transaction_count: 7,
  previous_month_income: '4000.00',
  previous_month_expenses: '1500.00',
  previous_month_net_cash_flow: '2500.00',
  income_change_percentage: '25.0',
  expense_change_percentage: '23.3',
  net_cash_flow_change_percentage: '26.0',
}

const mockCategories: CategorySpendingResponse = {
  year: 2026,
  month: 9,
  total_expenses: '1850.00',
  items: [
    { category: 'Food', amount: '1200.00', percentage: '64.9', transaction_count: 3 },
    { category: 'Transport', amount: '650.00', percentage: '35.1', transaction_count: 2 },
  ],
}

const mockIncomeCategories: IncomeCategoryResponse = {
  year: 2026,
  month: 9,
  total_income: '5000.00',
  items: [
    { category: 'Pocket Money', amount: '4000.00', percentage: '80.0', transaction_count: 1 },
    { category: 'Freelance', amount: '1000.00', percentage: '20.0', transaction_count: 1 },
  ],
}

const mockTrend: DailyTrendResponse = {
  year: 2026,
  month: 9,
  days: [
    { date: '2026-09-01', income: '4000.00', expenses: '200.00', net: '3800.00' },
    { date: '2026-09-02', income: '0.00', expenses: '150.00', net: '-150.00' },
    { date: '2026-09-03', income: '0.00', expenses: '0.00', net: '0.00' },
  ],
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
      <BrowserRouter>
        <AuthProvider>{ui}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Phase 3 - Analytics & Insights Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tokenStorage.setToken('valid-mock-jwt-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(transactionService, 'getSummary').mockResolvedValue(mockSummary)
    vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
      items: [],
      total: 0,
      limit: 5,
      offset: 0,
    })
  })

  describe('1. MonthNavigator Component', () => {
    it('renders current month and disables next button on current/future month', () => {
      const handleChange = vi.fn()
      const now = new Date()
      const curYear = now.getFullYear()
      const curMonth = now.getMonth() + 1

      render(<MonthNavigator year={curYear} month={curMonth} onChange={handleChange} />)

      expect(screen.getByText(/Current/i)).toBeInTheDocument()
      const nextBtn = screen.getByRole('button', { name: /Next month/i })
      expect(nextBtn).toBeDisabled()

      const prevBtn = screen.getByRole('button', { name: /Previous month/i })
      fireEvent.click(prevBtn)
      expect(handleChange).toHaveBeenCalledWith(
        curMonth === 1 ? curYear - 1 : curYear,
        curMonth === 1 ? 12 : curMonth - 1
      )
    })

    it('enables next button when viewing a past month and shows This Month button', () => {
      const handleChange = vi.fn()
      render(<MonthNavigator year={2025} month={8} onChange={handleChange} />)

      expect(screen.getByText('August 2025')).toBeInTheDocument()
      const nextBtn = screen.getByRole('button', { name: /Next month/i })
      expect(nextBtn).not.toBeDisabled()

      const thisMonthBtn = screen.getByRole('button', { name: /This Month/i })
      expect(thisMonthBtn).toBeInTheDocument()
      fireEvent.click(thisMonthBtn)

      const now = new Date()
      expect(handleChange).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
    })
  })

  describe('2. DashboardPage Analytics Integration', () => {
    it('renders Current Account State and Selected Month Activity with real values', async () => {
      vi.spyOn(analyticsService, 'getSummary').mockResolvedValue(mockSummary)
      vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue(mockMonthly)
      vi.spyOn(analyticsService, 'getCategories').mockResolvedValue(mockCategories)
      vi.spyOn(analyticsService, 'getTrend').mockResolvedValue(mockTrend)

      renderWithProviders(<DashboardPage />)

      // Account State values
      await waitFor(() => {
        expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
      })
      expect(screen.getAllByText('₹4,650.00').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThanOrEqual(1) // Starting
      expect(screen.getAllByText('₹5,000.00').length).toBeGreaterThanOrEqual(1) // Total income

      // Selected Month Activity
      expect(screen.getByText(/Selected Month Activity/i)).toBeInTheDocument()
      expect(screen.getByText('+25.0% vs last month')).toBeInTheDocument()
      expect(screen.getByText('+23.3% vs last month')).toBeInTheDocument()

      // Category breakdown
      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Transport')).toBeInTheDocument()
      expect(screen.getByText('(64.9%)')).toBeInTheDocument()
    })

    it('renders clean zero state (₹0.00) when all values are zero', async () => {
      vi.spyOn(transactionService, 'getSummary').mockResolvedValue({
        starting_balance: '0.00',
        total_income: '0.00',
        total_expenses: '0.00',
        net_cash_flow: '0.00',
        current_balance: '0.00',
        income_transaction_count: 0,
        expense_transaction_count: 0,
        currency: 'INR',
      })
      vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue({
        year: 2026,
        month: 9,
        monthly_income: '0.00',
        monthly_expenses: '0.00',
        monthly_net_cash_flow: '0.00',
        transaction_count: 0,
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
        total_expenses: '0.00',
        items: [],
      })
      vi.spyOn(analyticsService, 'getTrend').mockResolvedValue({
        year: 2026,
        month: 9,
        days: [],
      })

      renderWithProviders(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/Current Balance/i)).toBeInTheDocument()
      })

      const zeros = screen.getAllByText('₹0.00')
      expect(zeros.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/No spending data for this month/i)).toBeInTheDocument()
      expect(screen.getByText(/No transaction activity recorded for this month/i)).toBeInTheDocument()
    })
  })

  describe('3. Category & Income Sections', () => {
    it('renders CategorySpendingSection with items and empty state correctly', () => {
      const { rerender } = render(
        <CategorySpendingSection
          data={mockCategories}
          isLoading={false}
          isError={false}
        />
      )

      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Transport')).toBeInTheDocument()
      expect(screen.getByText('₹1,200.00')).toBeInTheDocument()
      expect(screen.getByText('(64.9%)')).toBeInTheDocument()

      // Empty state rerender
      rerender(
        <CategorySpendingSection
          data={{ year: 2026, month: 9, total_expenses: '0.00', items: [] }}
          isLoading={false}
          isError={false}
        />
      )
      expect(screen.getByText(/No spending data for this month/i)).toBeInTheDocument()
    })

    it('renders IncomeBreakdownSection with items and empty state correctly', () => {
      const { rerender } = render(
        <IncomeBreakdownSection
          data={mockIncomeCategories}
          isLoading={false}
          isError={false}
        />
      )

      expect(screen.getByText('Pocket Money')).toBeInTheDocument()
      expect(screen.getByText('Freelance')).toBeInTheDocument()
      expect(screen.getByText('₹4,000.00')).toBeInTheDocument()
      expect(screen.getByText('(80.0%)')).toBeInTheDocument()

      // Empty state
      rerender(
        <IncomeBreakdownSection
          data={{ year: 2026, month: 9, total_income: '0.00', items: [] }}
          isLoading={false}
          isError={false}
        />
      )
      expect(screen.getByText(/No income data for this month/i)).toBeInTheDocument()
    })

    it('renders SpendingTrendSection empty state when no transactions exist', () => {
      render(
        <SpendingTrendSection
          data={{ year: 2026, month: 9, days: [] }}
          isLoading={false}
          isError={false}
        />
      )
      expect(
        screen.getByText(/No transaction activity recorded for this month/i)
      ).toBeInTheDocument()
    })
  })

  describe('4. InsightsPage Real Analytics', () => {
    it('renders deterministic factual summaries without mock values or unsolicited advice', async () => {
      vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue(mockMonthly)
      vi.spyOn(analyticsService, 'getCategories').mockResolvedValue(mockCategories)
      vi.spyOn(analyticsService, 'getIncomeCategories').mockResolvedValue(mockIncomeCategories)
      vi.spyOn(analyticsService, 'getTrend').mockResolvedValue(mockTrend)

      renderWithProviders(<InsightsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Financial Insights/i)).toBeInTheDocument()
      })

      // Deterministic highlight: Food represents 64.9% of this month's expenses
      await waitFor(() => {
        expect(screen.getByText(/Primary Expense: Food/i)).toBeInTheDocument()
      })
      expect(
        screen.getByText(/Food represents 64.9% of this month's expenses/i)
      ).toBeInTheDocument()

      // Deterministic highlight: Pocket Money represents 80.0% of recorded monthly inflows
      expect(screen.getByText(/Primary Income: Pocket Money/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Pocket Money represents 80.0% of recorded monthly inflows/i)
      ).toBeInTheDocument()

      // Core Copilot Principle (Deterministic Core)
      expect(screen.getByText(/Deterministic Core/i)).toBeInTheDocument()

      // Verify no mock nudges like "Transit Efficiency" or "Canteen Pacing" exist
      expect(screen.queryByText(/Transit Efficiency/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Canteen Pacing/i)).not.toBeInTheDocument()
    })
  })
})
