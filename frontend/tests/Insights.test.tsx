import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { InsightsPage } from '@/pages/InsightsPage'
import { InsightCard } from '@/components/insights/InsightCard'
import { DashboardInsightsPreview } from '@/components/insights/DashboardInsightsPreview'
import { insightService } from '@/services/insightService'
import { analyticsService } from '@/services/analyticsService'
import { authService, tokenStorage } from '@/services/authService'
import type { FinancialInsight, InsightsResponse } from '@/types/insight'
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

const mockInsightsList: FinancialInsight[] = [
  {
    id: 'cash-flow-1',
    type: 'cash_flow',
    priority: 'positive',
    category: 'Cash Flow',
    title: 'Positive Cash Flow',
    description: 'Your income exceeded expenses by ₹8,500.00 this month.',
    amount: '8500.00',
    percentage: null,
    period: '2026-09',
  },
  {
    id: 'top-cat-1',
    type: 'top_category',
    priority: 'info',
    category: 'Food & Dining',
    title: 'Top Expense Category',
    description: 'Food & Dining is your highest expense category this month at ₹4,200.00 (52.5% of total expenses).',
    amount: '4200.00',
    percentage: '52.5',
    period: '2026-09',
  },
  {
    id: 'trend-1',
    type: 'spending_trend',
    priority: 'warning',
    category: 'Food & Dining',
    title: 'Food & Dining Spending Increased',
    description: 'Food & Dining spending increased 18.4% compared with last month (₹4,200.00 vs ₹3,547.00).',
    amount: '4200.00',
    percentage: '18.4',
    period: '2026-09',
  },
  {
    id: 'budget-1',
    type: 'budget',
    priority: 'warning',
    category: 'Food & Dining',
    title: 'Food & Dining Approaching Budget Limit',
    description: 'Food & Dining has used 92.0% of its monthly budget (₹4,200.00 spent of ₹4,565.00 limit).',
    amount: '4200.00',
    percentage: '92.0',
    period: '2026-09',
  },
  {
    id: 'goal-1',
    type: 'goal',
    priority: 'info',
    category: 'Savings Goal',
    title: 'New Laptop Goal Progress',
    description: 'New Laptop is 40.0% complete (₹20,000.00 saved of ₹50,000.00). ₹30,000.00 remains to reach target.',
    amount: '20000.00',
    percentage: '40.0',
    period: '2026-09',
  },
  {
    id: 'rec-1',
    type: 'recurring_pattern',
    priority: 'info',
    category: 'Subscriptions',
    title: 'Recurring Expense Pattern',
    description: 'Possible recurring monthly expense pattern detected in Subscriptions (~₹499.00 across 3 occurrences).',
    amount: '499.00',
    percentage: null,
    period: '2026-09',
  },
]

const mockFullResponse: InsightsResponse = {
  period: '2026-09',
  year: 2026,
  month: 9,
  has_sufficient_data: true,
  summary: {
    total_insights_count: 6,
    positive_count: 1,
    warning_count: 2,
    info_count: 3,
    has_sufficient_data: true,
  },
  insights: mockInsightsList,
}

const mockEmptyResponse: InsightsResponse = {
  period: '2026-09',
  year: 2026,
  month: 9,
  has_sufficient_data: false,
  summary: {
    total_insights_count: 0,
    positive_count: 0,
    warning_count: 0,
    info_count: 0,
    has_sufficient_data: false,
  },
  insights: [],
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

describe('Phase 6 — Advanced Financial Insights Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tokenStorage.setToken('mock-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)

    // Mock analytics queries so InsightsPage renders cleanly
    vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue({
      year: 2026,
      month: 9,
      monthly_income: '15000.00',
      monthly_expenses: '6500.00',
      monthly_net_cash_flow: '8500.00',
      transaction_count: 10,
      previous_month_income: '12000.00',
      previous_month_expenses: '5000.00',
      previous_month_net_cash_flow: '7000.00',
      income_change_percentage: '25.0',
      expense_change_percentage: '30.0',
      net_cash_flow_change_percentage: '21.4',
    })
    vi.spyOn(analyticsService, 'getCategories').mockResolvedValue({
      year: 2026,
      month: 9,
      total_expenses: '6500.00',
      items: [
        {
          category: 'Food & Dining',
          amount: '4200.00',
          percentage: '64.6',
          transaction_count: 8,
        },
      ],
    })
    vi.spyOn(analyticsService, 'getIncomeCategories').mockResolvedValue({
      year: 2026,
      month: 9,
      total_income: '15000.00',
      items: [
        {
          category: 'Allowance',
          amount: '15000.00',
          percentage: '100.0',
          transaction_count: 1,
        },
      ],
    })
    vi.spyOn(analyticsService, 'getTrend').mockResolvedValue({
      year: 2026,
      month: 9,
      days: [],
    })
  })

  describe('InsightsPage Component', () => {
    it('renders loading state initially', async () => {
      vi.spyOn(insightService, 'getInsights').mockReturnValue(new Promise(() => {}))

      renderWithProviders(<InsightsPage />)

      expect(screen.getByText('Financial Insights')).toBeInTheDocument()
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('renders empty / insufficient data state with helpful guidance', async () => {
      vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockEmptyResponse)

      renderWithProviders(<InsightsPage />)

      await waitFor(() => {
        expect(screen.getByText(/No financial insights yet/i)).toBeInTheDocument()
      })

      expect(
        screen.getByText(/Add more transactions, budgets, or savings goals to uncover spending patterns/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Add Transaction/i })).toHaveAttribute('href', '/activity')
    })

    it('renders real insights and summary metrics when data is present', async () => {
      vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockFullResponse)

      renderWithProviders(<InsightsPage />)

      await waitFor(() => {
        expect(screen.getByText('Positive Cash Flow')).toBeInTheDocument()
      })

      expect(screen.getByText('Food & Dining Spending Increased')).toBeInTheDocument()
      expect(screen.getByText('Food & Dining Approaching Budget Limit')).toBeInTheDocument()
      expect(screen.getByText('New Laptop Goal Progress')).toBeInTheDocument()
      expect(screen.getByText('Recurring Expense Pattern')).toBeInTheDocument()

      expect(screen.getByText('Deterministic observations from verified account transactions.')).toBeInTheDocument()
    })

    it('filters insights correctly by priority tabs', async () => {
      vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockFullResponse)

      renderWithProviders(<InsightsPage />)

      await waitFor(() => {
        expect(screen.getByText('Positive Cash Flow')).toBeInTheDocument()
      })

      // Click on "Warnings" tab
      const warningsTab = screen.getByRole('button', { name: /Warnings/i })
      fireEvent.click(warningsTab)

      expect(screen.getByText('Food & Dining Spending Increased')).toBeInTheDocument()
      expect(screen.getByText('Food & Dining Approaching Budget Limit')).toBeInTheDocument()
      expect(screen.queryByText('Positive Cash Flow')).not.toBeInTheDocument()
      expect(screen.queryByText('Recurring Expense Pattern')).not.toBeInTheDocument()

      // Click on "Positive" tab
      const positiveTab = screen.getByRole('button', { name: /Positive/i })
      fireEvent.click(positiveTab)

      expect(screen.getByText('Positive Cash Flow')).toBeInTheDocument()
      expect(screen.queryByText('Food & Dining Spending Increased')).not.toBeInTheDocument()

      // Click back on "All"
      const allTab = screen.getByRole('button', { name: /All/i })
      fireEvent.click(allTab)

      expect(screen.getByText('Positive Cash Flow')).toBeInTheDocument()
      expect(screen.getByText('Food & Dining Spending Increased')).toBeInTheDocument()
    })

    it('handles API error state with a retry option', async () => {
      vi.spyOn(insightService, 'getInsights').mockRejectedValue(new Error('Network error loading insights'))

      renderWithProviders(<InsightsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load financial insights/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })
  })

  describe('InsightCard Component', () => {
    it('renders positive cash flow card with amount and status badge', () => {
      render(
        <InsightCard
          insight={{
            id: 'test-1',
            type: 'cash_flow',
            priority: 'positive',
            category: 'Cash Flow',
            title: 'Surplus Generated',
            description: 'Income exceeded spending by ₹5,000.',
            amount: '5000.00',
            percentage: null,
            period: '2026-09',
          }}
        />
      )

      expect(screen.getByText('Surplus Generated')).toBeInTheDocument()
      expect(screen.getByText('Income exceeded spending by ₹5,000.')).toBeInTheDocument()
      expect(screen.getByText('₹5,000.00')).toBeInTheDocument()
      expect(screen.getByText('Positive')).toBeInTheDocument()
    })

    it('renders warning card with percentage and correct badge', () => {
      render(
        <InsightCard
          insight={{
            id: 'test-2',
            type: 'budget',
            priority: 'warning',
            category: 'Food',
            title: 'Budget Exceeded',
            description: 'Over budget by ₹850.',
            amount: '850.00',
            percentage: '112.5',
            period: '2026-09',
          }}
        />
      )

      expect(screen.getByText('Budget Exceeded')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('+112.5%')).toBeInTheDocument()
    })

    it('renders compact mode appropriately for dashboard preview', () => {
      render(
        <InsightCard
          insight={{
            id: 'test-3',
            type: 'top_category',
            priority: 'info',
            category: 'Transport',
            title: 'Top Category',
            description: 'Highest expense of the month.',
            amount: '1200.00',
            percentage: '35.0',
            period: '2026-09',
          }}
          compact={true}
        />
      )

      expect(screen.getByText('Top Category')).toBeInTheDocument()
      expect(screen.getByText('₹1,200.00')).toBeInTheDocument()
    })
  })

  describe('DashboardInsightsPreview Component', () => {
    it('renders top insights with "View all insights" link', async () => {
      vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockFullResponse)

      renderWithProviders(<DashboardInsightsPreview year={2026} month={9} />)

      await waitFor(() => {
        expect(screen.getByText('Financial Insights')).toBeInTheDocument()
      })

      // Header and link
      const viewAllLink = screen.getByRole('link', { name: /View all insights/i })
      expect(viewAllLink).toBeInTheDocument()
      expect(viewAllLink).toHaveAttribute('href', '/insights')

      // Shows top sorted items (warning priority first)
      expect(screen.getByText('Food & Dining Spending Increased')).toBeInTheDocument()
      expect(screen.getByText('Food & Dining Approaching Budget Limit')).toBeInTheDocument()
      expect(screen.getByText('Positive Cash Flow')).toBeInTheDocument()
    })

    it('shows neutral data insufficiency message when no insights exist', async () => {
      vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockEmptyResponse)

      renderWithProviders(<DashboardInsightsPreview year={2026} month={9} />)

      await waitFor(() => {
        expect(screen.getByText(/More transaction history needed to uncover spending patterns/i)).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design Verification', () => {
    const viewports = [320, 375, 390, 412, 430, 768, 1024]

    viewports.forEach((width) => {
      it(`renders InsightCard and DashboardPreview cleanly at ${width}px without crashing`, async () => {
        window.innerWidth = width
        window.innerHeight = 800
        window.dispatchEvent(new Event('resize'))

        vi.spyOn(insightService, 'getInsights').mockResolvedValue(mockFullResponse)

        const { unmount } = renderWithProviders(<DashboardInsightsPreview year={2026} month={9} />)

        await waitFor(() => {
          expect(screen.getByText('Financial Insights')).toBeInTheDocument()
        })
        expect(screen.getByText('Food & Dining Spending Increased')).toBeInTheDocument()

        unmount()
      })
    })
  })
})

