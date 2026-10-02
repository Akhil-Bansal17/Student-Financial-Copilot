import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ForecastPage } from '@/pages/ForecastPage'
import { ForecastSummaryCards } from '@/components/forecast/ForecastSummaryCards'
import { ForecastChart } from '@/components/forecast/ForecastChart'
import { ForecastTimeline } from '@/components/forecast/ForecastTimeline'
import { ForecastWarnings } from '@/components/forecast/ForecastWarnings'
import { ForecastPreferenceModal } from '@/components/forecast/ForecastPreferenceModal'
import { ForecastGoalPlanningCard } from '@/components/forecast/ForecastGoalPlanningCard'
import { ForecastBudgetPressureCard } from '@/components/forecast/ForecastBudgetPressureCard'
import { DashboardForecastCard } from '@/components/forecast/DashboardForecastCard'
import { ForecastEmptyState } from '@/components/forecast/ForecastEmptyState'
import { forecastService } from '@/services/forecastService'
import { authService, tokenStorage } from '@/services/authService'
import type { CashFlowForecastResponse, ForecastSummaryResponse } from '@/types/forecast'
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

const mockForecastData: CashFlowForecastResponse = {
  current_ledger_balance: '15000.00',
  current_connected_bank_balance: '18000.00',
  starting_balance: '15000.00',
  projected_balance: '12500.00',
  net_cash_flow: '-2500.00',
  forecast_days: 30,
  expected_income: '5000.00',
  expected_recurring_expenses: '3500.00',
  estimated_discretionary_spending: '4000.00',
  projected_total_outflow: '7500.00',
  minimum_projected_balance: '11500.00',
  minimum_balance_date: '2026-10-25',
  is_negative_projected: false,
  negative_balance_date: null,
  is_low_balance_projected: false,
  low_balance_date: null,
  minimum_balance_threshold: '2000.00',
  data_sufficiency: 'STRONG',
  confidence: 'HIGH',
  bank_data_freshness: 'Bank data was synchronized less than an hour ago.',
  bank_last_synced_at: '2026-10-02T10:00:00Z',
  timeline: [
    {
      id: 'rec-1',
      date: '2026-10-05',
      type: 'RECURRING_SUBSCRIPTION',
      name: 'Netflix India',
      amount: '649.00',
      is_inflow: false,
      category: 'Entertainment',
      source: 'RECURRING_EXPENSE',
      is_known_commitment: true,
      projected_balance_after: '14351.00',
    },
    {
      id: 'inc-1',
      date: '2026-10-10',
      type: 'EXPECTED_INCOME',
      name: 'Expected Stipend',
      amount: '5000.00',
      is_inflow: true,
      category: 'Stipend',
      source: 'RECURRING_INCOME',
      is_known_commitment: false,
      projected_balance_after: '19351.00',
    },
    {
      id: 'disc-1',
      date: '2026-10-15',
      type: 'ESTIMATED_SPENDING',
      name: 'Estimated Discretionary Spending',
      amount: '1000.00',
      is_inflow: false,
      category: 'Other',
      source: 'ESTIMATED_SPENDING',
      is_known_commitment: false,
      projected_balance_after: '18351.00',
    },
  ],
  daily_points: [
    {
      date: '2026-10-02',
      projected_balance: '15000.00',
      is_actual: true,
      events_count: 0,
      daily_inflow: '0.00',
      daily_outflow: '0.00',
      is_below_minimum: false,
      is_negative: false,
    },
    {
      date: '2026-10-05',
      projected_balance: '14351.00',
      is_actual: false,
      events_count: 1,
      daily_inflow: '0.00',
      daily_outflow: '649.00',
      is_below_minimum: false,
      is_negative: false,
    },
    {
      date: '2026-10-10',
      projected_balance: '19351.00',
      is_actual: false,
      events_count: 1,
      daily_inflow: '5000.00',
      daily_outflow: '0.00',
      is_below_minimum: false,
      is_negative: false,
    },
  ],
  goal_planning: [
    {
      goal_id: 1,
      goal_name: 'Emergency Fund',
      target_amount: '10000.00',
      current_amount: '4000.00',
      remaining_amount: '6000.00',
      target_date: '2027-01-01',
      suggested_monthly_allocation: '2000.00',
      is_affordable: true,
    },
  ],
  budget_pressure: [
    {
      budget_id: 1,
      category: 'Entertainment',
      allocated_amount: '2000.00',
      spent_amount: '600.00',
      projected_recurring_spend: '649.00',
      projected_total_spend: '1249.00',
      utilization_percentage: '62.5',
      projected_over_budget: false,
    },
  ],
  contributing_factors: [
    '₹3,500.00 in verified recurring commitments across 1 scheduled payment(s).',
    '₹5,000.00 in predictable recurring income.',
  ],
  warnings: [],
}

const mockSummaryData: ForecastSummaryResponse = {
  current_ledger_balance: '15000.00',
  current_connected_bank_balance: '18000.00',
  starting_balance: '15000.00',
  projected_balance: '12500.00',
  net_cash_flow: '-2500.00',
  forecast_days: 30,
  expected_income: '5000.00',
  expected_recurring_expenses: '3500.00',
  estimated_discretionary_spending: '4000.00',
  projected_total_outflow: '7500.00',
  minimum_projected_balance: '11500.00',
  minimum_balance_date: '2026-10-25',
  is_negative_projected: false,
  negative_balance_date: null,
  is_low_balance_projected: false,
  low_balance_date: null,
  minimum_balance_threshold: '2000.00',
  data_sufficiency: 'STRONG',
  confidence: 'HIGH',
  bank_data_freshness: 'Bank data was synchronized less than an hour ago.',
  bank_last_synced_at: '2026-10-02T10:00:00Z',
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

describe('Cash Flow Forecasting & Financial Planning Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tokenStorage.setToken('mock-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    vi.spyOn(forecastService, 'getForecast').mockResolvedValue(mockForecastData)
    vi.spyOn(forecastService, 'getSummary').mockResolvedValue(mockSummaryData)
    vi.spyOn(forecastService, 'updatePreference').mockResolvedValue({
      id: 1,
      user_id: 1,
      minimum_balance_threshold: '3000.00',
      is_enabled: true,
      created_at: '2026-09-22T00:00:00Z',
      updated_at: '2026-10-02T00:00:00Z',
    })
  })

  // 1. Forecast Page Rendering
  it('renders forecast page with title and horizon switcher', async () => {
    renderWithProviders(<ForecastPage />)
    expect(await screen.findByText('Cash Flow Forecast')).toBeInTheDocument()
    expect(screen.getByText('7 Days')).toBeInTheDocument()
    expect(screen.getByText('30 Days')).toBeInTheDocument()
    expect(screen.getByText('90 Days')).toBeInTheDocument()
  })

  // 2. Loading State
  it('renders loading skeleton when fetching forecast', () => {
    vi.spyOn(forecastService, 'getForecast').mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<ForecastPage />)
    expect(screen.getByTestId('forecast-loading')).toBeInTheDocument()
  })

  // 3. Error State
  it('renders error alert with retry button on query failure', async () => {
    vi.spyOn(forecastService, 'getForecast').mockRejectedValue(new Error('Network error'))
    renderWithProviders(<ForecastPage />)
    expect(await screen.findByTestId('forecast-error')).toBeInTheDocument()
    expect(screen.getByText('Unable to load cash flow forecast')).toBeInTheDocument()
  })

  // 4. Horizon Switching (7, 30, 90 days)
  it('switches horizons and refetches forecast with updated days', async () => {
    renderWithProviders(<ForecastPage />)
    await screen.findByText('Cash Flow Forecast')

    const button7 = screen.getByText('7 Days')
    fireEvent.click(button7)

    await waitFor(() => {
      expect(forecastService.getForecast).toHaveBeenCalledWith(7)
    })

    const button90 = screen.getByText('90 Days')
    fireEvent.click(button90)

    await waitFor(() => {
      expect(forecastService.getForecast).toHaveBeenCalledWith(90)
    })
  })

  // 5. Summary Cards Display
  it('renders summary cards with ledger balance, bank balance, and projected values', () => {
    renderWithProviders(
      <ForecastSummaryCards
        forecast={mockForecastData}
        onOpenPreference={vi.fn()}
      />
    )
    expect(screen.getByTestId('forecast-summary-cards')).toBeInTheDocument()
    expect(screen.getByText('₹12,500.00')).toBeInTheDocument()
    expect(screen.getByText('₹15,000.00')).toBeInTheDocument()
    expect(screen.getByText('₹18,000.00')).toBeInTheDocument()
    expect(screen.getByText('Data: STRONG')).toBeInTheDocument()
    expect(screen.getByText('Confidence: HIGH')).toBeInTheDocument()
  })

  // 6. Forecast Timeline Feed & Filtering
  it('renders forecast timeline and allows filtering by event type', () => {
    renderWithProviders(
      <ForecastTimeline
        timeline={mockForecastData.timeline}
        forecastDays={30}
      />
    )
    expect(screen.getByTestId('forecast-timeline')).toBeInTheDocument()
    expect(screen.getByText('Netflix India')).toBeInTheDocument()
    expect(screen.getByText('Expected Stipend')).toBeInTheDocument()
    expect(screen.getByText('Estimated Discretionary Spending')).toBeInTheDocument()

    // Filter to only Inflows
    const inflowsFilter = screen.getByText('Inflows')
    fireEvent.click(inflowsFilter)
    expect(screen.getByText('Expected Stipend')).toBeInTheDocument()
    expect(screen.queryByText('Netflix India')).not.toBeInTheDocument()
  })

  // 7. Projected Balance Chart
  it('renders projected balance chart container with points', () => {
    renderWithProviders(
      <ForecastChart
        dailyPoints={mockForecastData.daily_points}
        minimumThreshold={mockForecastData.minimum_balance_threshold}
        forecastDays={30}
      />
    )
    expect(screen.getByTestId('forecast-chart-container')).toBeInTheDocument()
    expect(screen.getByText('Projected Cash Flow Curve')).toBeInTheDocument()
  })

  // 8. Low-Balance Warning Alert
  it('renders low-balance warning when projected balance dips below buffer', () => {
    const lowBalData: CashFlowForecastResponse = {
      ...mockForecastData,
      is_low_balance_projected: true,
      low_balance_date: '2026-10-18',
    }
    renderWithProviders(<ForecastWarnings forecast={lowBalData} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Low Balance Threshold Alert')).toBeInTheDocument()
    expect(screen.getByText('2026-10-18')).toBeInTheDocument()
  })

  // 9. Negative Balance Critical Warning
  it('renders negative balance critical warning when deficit is projected', () => {
    const negData: CashFlowForecastResponse = {
      ...mockForecastData,
      is_negative_projected: true,
      negative_balance_date: '2026-11-04',
    }
    renderWithProviders(<ForecastWarnings forecast={negData} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Projected Negative Balance Warning')).toBeInTheDocument()
    expect(screen.getByText('2026-11-04')).toBeInTheDocument()
  })

  // 10. Minimum Balance Preference Modal
  it('allows opening preference modal and saving a customized buffer threshold', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <ForecastPreferenceModal
        isOpen={true}
        onClose={onClose}
        currentThreshold="2000.00"
      />
    )
    expect(screen.getByTestId('forecast-preference-modal')).toBeInTheDocument()

    // Click quick preset ₹3,000
    const preset3k = screen.getByText('₹3,000')
    fireEvent.click(preset3k)

    const saveBtn = screen.getByText('Save Preference')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(forecastService.updatePreference).toHaveBeenCalledWith({
        minimum_balance_threshold: 3000,
      })
    })
  })

  // 11. Dashboard Forecast Card
  it('renders compact dashboard forecast card with 30-day projection', async () => {
    renderWithProviders(<DashboardForecastCard />)
    expect(await screen.findByTestId('dashboard-forecast-card')).toBeInTheDocument()
    expect(screen.getByText('Cash Flow Forecast')).toBeInTheDocument()
    expect(screen.getByText('₹12,500.00')).toBeInTheDocument()
    expect(screen.getByText('₹3,500.00')).toBeInTheDocument()
    expect(screen.getByText('₹11,500.00')).toBeInTheDocument()
  })

  // 12. Goal Planning Feasibility
  it('renders goal planning cards with monthly allocation and affordability badge', () => {
    renderWithProviders(<ForecastGoalPlanningCard goals={mockForecastData.goal_planning} />)
    expect(screen.getByText('Goal Cash Flow Planning')).toBeInTheDocument()
    expect(screen.getByText('Emergency Fund')).toBeInTheDocument()
    expect(screen.getByText('Affordable')).toBeInTheDocument()
    expect(screen.getByText('₹2,000/mo')).toBeInTheDocument()
  })

  // 13. Budget Spending Pressure
  it('renders category budget pressure with utilization and projected totals', () => {
    renderWithProviders(<ForecastBudgetPressureCard budgets={mockForecastData.budget_pressure} />)
    expect(screen.getByText('Budget Spending Pressure')).toBeInTheDocument()
    expect(screen.getByText('Entertainment')).toBeInTheDocument()
    expect(screen.getByText('62.5% projected')).toBeInTheDocument()
    expect(screen.getByText('On Track')).toBeInTheDocument()
  })

  // 14. Empty / Insufficient Data State
  it('renders empty state prompting transaction entry when data is empty', () => {
    renderWithProviders(<ForecastEmptyState />)
    expect(screen.getByText('Cash Flow Forecasting')).toBeInTheDocument()
    expect(screen.getByText('Record Transactions')).toBeInTheDocument()
  })
})
