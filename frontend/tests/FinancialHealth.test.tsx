import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { FinancialHealthPage } from '@/pages/FinancialHealthPage'
import { HealthDimensionCard } from '@/components/financialHealth/HealthDimensionCard'
import { SmartActionCard } from '@/components/financialHealth/SmartActionCard'
import { PositiveSignalCard } from '@/components/financialHealth/PositiveSignalCard'
import { BankFreshnessBanner } from '@/components/financialHealth/BankFreshnessBanner'
import { DataSufficiencyBanner } from '@/components/financialHealth/DataSufficiencyBanner'
import { DashboardFinancialHealthCard } from '@/components/financialHealth/DashboardFinancialHealthCard'
import { financialHealthService } from '@/services/financialHealthService'
import type {
  FinancialHealthResponse,
  HealthDimensionDetail,
  SmartActionItem,
  PositiveSignalItem,
  BankFreshnessDetail,
} from '@/types/financialHealth'

const mockHealthData: FinancialHealthResponse = {
  overview: {
    data_sufficiency: 'STRONG',
    overall_status_label: 'Attention Required',
    overall_summary:
      'Your financial position requires attention: projected balance drops below your ₹2,000.00 minimum buffer in 12 days.',
    critical_actions_count: 1,
    high_actions_count: 1,
    total_actions_count: 2,
    positive_signals_count: 2,
    primary_attention_dimension: 'FORECAST_RISK',
  },
  dimensions: {
    CASH_BUFFER: {
      dimension: 'CASH_BUFFER',
      name: 'Cash Buffer',
      status: 'LOW_BUFFER',
      label: 'Low Buffer',
      summary: 'Projected minimum balance drops below your ₹2,000.00 threshold to ₹800.00 on 2026-10-18.',
      supporting_data: {
        current_ledger_balance: '4500.00',
        minimum_projected_balance: '800.00',
        minimum_threshold: '2000.00',
        minimum_balance_date: '2026-10-18',
      },
      is_positive: false,
      is_attention_required: true,
    },
    CASH_FLOW_STABILITY: {
      dimension: 'CASH_FLOW_STABILITY',
      name: 'Cash-Flow Stability',
      status: 'STABLE',
      label: 'Stable',
      summary: 'Inflow and recurring commitment patterns are predictable with consistent pacing.',
      supporting_data: {
        monthly_net_cash_flow: '1200.00',
      },
      is_positive: true,
      is_attention_required: false,
    },
    BUDGET_HEALTH: {
      dimension: 'BUDGET_HEALTH',
      name: 'Budget Health',
      status: 'APPROACHING_LIMIT',
      label: 'Approaching Limit',
      summary: 'Spending has reached 80%+ of allocated budget in Food & Dining.',
      supporting_data: {
        approaching_categories: ['Food & Dining'],
        overall_utilization_pct: '85.4',
      },
      is_positive: false,
      is_attention_required: true,
    },
    RECURRING_BURDEN: {
      dimension: 'RECURRING_BURDEN',
      name: 'Recurring Burden',
      status: 'MODERATE',
      label: 'Moderate',
      summary: 'Recurring commitments are manageable at ₹1,499.00/mo (18.5% of baseline).',
      supporting_data: {
        monthly_committed: '1499.00',
        subscription_count: 3,
        burden_percentage: '18.5',
      },
      is_positive: true,
      is_attention_required: false,
    },
    GOAL_HEALTH: {
      dimension: 'GOAL_HEALTH',
      name: 'Savings & Goals',
      status: 'ON_TRACK',
      label: 'On Track',
      summary: 'All 2 active savings goals are progressing feasibly toward targets.',
      supporting_data: {
        active_goals_count: 2,
        overall_progress_percentage: '65.0',
        total_target_amount: '25000.00',
        total_saved_amount: '16250.00',
      },
      is_positive: true,
      is_attention_required: false,
    },
    SPENDING_PATTERN: {
      dimension: 'SPENDING_PATTERN',
      name: 'Spending Pattern',
      status: 'BALANCED',
      label: 'Balanced',
      summary: 'Spending is diversified across essential campus categories without extreme concentration.',
      supporting_data: {
        top_category: 'Food & Dining',
        top_category_percentage: '34.2',
      },
      is_positive: true,
      is_attention_required: false,
    },
    FORECAST_RISK: {
      dimension: 'FORECAST_RISK',
      name: 'Forecast Risk',
      status: 'HIGH_RISK',
      label: 'High Risk',
      summary: 'Projected balance is forecasted to drop below your safety threshold within 30 days.',
      supporting_data: {
        projected_minimum: '800.00',
        minimum_date: '2026-10-18',
        is_low_projected: true,
      },
      is_positive: false,
      is_attention_required: true,
    },
  },
  actions: [
    {
      id: 'action_forecast_buffer_breach',
      type: 'FORECAST_BUFFER_BREACH',
      title: 'Buffer Breach Forecasted',
      description: 'Projected balance drops below your ₹2,000.00 minimum safety threshold on 2026-10-18 (projected low ₹800.00).',
      priority: 'CRITICAL',
      reason: 'Upcoming recurring expenses or high daily outflow will deplete your available cash buffer.',
      supporting_metric: 'Projected low ₹800.00 on 2026-10-18',
      related_entity: { entity_type: 'forecast' },
      recommended_next_step: 'Review upcoming recurring commitments and defer discretionary expenses.',
      action_url: '/forecast',
      generated_at: '2026-10-03T10:00:00Z',
    },
    {
      id: 'action_budget_approaching_limit',
      type: 'BUDGET_APPROACHING_LIMIT',
      title: 'Food & Dining Budget Approaching Cap',
      description: 'Food & Dining has reached 85.4% of monthly allocated limit.',
      priority: 'HIGH',
      reason: 'High category pace with several days remaining in current month.',
      supporting_metric: '85.4% utilized',
      related_entity: { entity_type: 'budget', category: 'Food & Dining' },
      recommended_next_step: 'Pace daily dining spending for the remainder of the month.',
      action_url: '/budgets',
      generated_at: '2026-10-03T10:00:00Z',
    },
  ],
  positive_signals: [
    {
      id: 'signal_recurring_manageable',
      dimension: 'RECURRING_BURDEN',
      title: 'Manageable Fixed Commitments',
      description: 'Recurring expenses represent only 18.5% of your monthly spending baseline.',
      supporting_data: { burden_percentage: '18.5' },
    },
    {
      id: 'signal_goals_progressing',
      dimension: 'GOAL_HEALTH',
      title: 'Savings Goals on Target',
      description: '2 active savings goals are progressing feasibly toward target deadlines.',
      supporting_data: { overall_progress: '65.0' },
    },
  ],
  bank_freshness: {
    connected_accounts_count: 1,
    has_connected_bank: true,
    last_synced_at: '2026-10-03T09:30:00Z',
    is_stale: false,
    sync_status: 'SUCCESS',
    freshness_description: 'Bank data synchronized 30 minutes ago. Balances are fresh.',
    impacts_assessment: false,
  },
  data_sufficiency: 'STRONG',
  generated_at: '2026-10-03T10:00:00Z',
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Financial Health & Smart Action Center', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Financial Health page with deterministic overview and dimensions', async () => {
    vi.spyOn(financialHealthService, 'getFinancialHealth').mockResolvedValue(mockHealthData)

    renderWithClient(<FinancialHealthPage />)

    // Wait for content to render
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Financial Health/i })).toBeInTheDocument()
    })

    expect(screen.getByText('Deterministic')).toBeInTheDocument()
    expect(screen.getByText(/Attention Required/i)).toBeInTheDocument()
    expect(screen.getByText(/Evaluated deterministically across 7 financial dimensions/i)).toBeInTheDocument()

    // Dimensions check
    expect(screen.getByText('Cash Buffer')).toBeInTheDocument()
    expect(screen.getByText('Cash-Flow Stability')).toBeInTheDocument()
    expect(screen.getByText('Budget Health')).toBeInTheDocument()
    expect(screen.getByText('Recurring Burden')).toBeInTheDocument()
    expect(screen.getByText('Savings & Goals')).toBeInTheDocument()
    expect(screen.getByText('Spending Pattern')).toBeInTheDocument()
    expect(screen.getByText('Forecast Risk')).toBeInTheDocument()

    // Smart Actions check
    expect(screen.getByText('Buffer Breach Forecasted')).toBeInTheDocument()
    expect(screen.getByText('Food & Dining Budget Approaching Cap')).toBeInTheDocument()
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    expect(screen.getByText('HIGH PRIORITY')).toBeInTheDocument()

    // Positive Signals check
    expect(screen.getByText("What's Working Well")).toBeInTheDocument()
    expect(screen.getByText('Manageable Fixed Commitments')).toBeInTheDocument()
    expect(screen.getByText('Savings Goals on Target')).toBeInTheDocument()
  })

  it('renders HealthDimensionCard with correct status badge and supporting metrics', () => {
    const detail: HealthDimensionDetail = {
      dimension: 'CASH_BUFFER',
      name: 'Cash Buffer',
      status: 'HEALTHY_BUFFER',
      label: 'Healthy Buffer',
      summary: 'Projected balance remains comfortably above minimum threshold.',
      supporting_data: {
        current_ledger_balance: '25000.00',
        minimum_projected_balance: '18500.00',
      },
      is_positive: true,
      is_attention_required: false,
    }

    renderWithClient(<HealthDimensionCard detail={detail} />)

    expect(screen.getByText('Cash Buffer')).toBeInTheDocument()
    expect(screen.getByText('Healthy Buffer')).toBeInTheDocument()
    expect(screen.getByText(/Projected balance remains comfortably above/i)).toBeInTheDocument()
    expect(screen.getByText(/₹25,000/i)).toBeInTheDocument()
    expect(screen.getByText(/₹18,500/i)).toBeInTheDocument()
  })

  it('renders SmartActionCard with priority, reason, evidence, and CTA action link', () => {
    const action: SmartActionItem = {
      id: 'test_action_1',
      type: 'BUDGET_OVERRUN',
      title: 'Food Budget Exceeded',
      description: 'You have spent ₹3,400 of your ₹3,000 budget.',
      priority: 'HIGH',
      reason: 'Recent restaurant dining transactions caused an overspend.',
      supporting_metric: '113.3% utilized',
      related_entity: { entity_type: 'budget' },
      recommended_next_step: 'Check Food transactions and adjust category allocations.',
      action_url: '/budgets',
      generated_at: '2026-10-03T10:00:00Z',
    }

    renderWithClient(<SmartActionCard action={action} />)

    expect(screen.getByText('HIGH PRIORITY')).toBeInTheDocument()
    expect(screen.getByText('Food Budget Exceeded')).toBeInTheDocument()
    expect(screen.getByText(/You have spent ₹3,400 of your ₹3,000 budget/i)).toBeInTheDocument()
    expect(screen.getByText('113.3% utilized')).toBeInTheDocument()
    expect(screen.getByText('Take Action')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /Take Action/i })
    expect(link).toHaveAttribute('href', '/budgets')
  })

  it('renders PositiveSignalCard with title and description', () => {
    const signal: PositiveSignalItem = {
      id: 'test_signal_1',
      dimension: 'BUDGET_HEALTH',
      title: 'Budget on Track',
      description: 'Current spending is 42% below monthly budget limits.',
    }

    renderWithClient(<PositiveSignalCard signal={signal} />)

    expect(screen.getByText('Budget on Track')).toBeInTheDocument()
    expect(screen.getByText('Current spending is 42% below monthly budget limits.')).toBeInTheDocument()
  })

  it('shows BankFreshnessBanner with warning when bank data is stale', () => {
    const staleFreshness: BankFreshnessDetail = {
      connected_accounts_count: 1,
      has_connected_bank: true,
      last_synced_at: '2026-10-01T10:00:00Z',
      is_stale: true,
      sync_status: 'DELAYED',
      freshness_description: 'Bank data has not synchronized in 48 hours. Recent bank transactions may be missing.',
      impacts_assessment: true,
    }

    renderWithClient(<BankFreshnessBanner freshness={staleFreshness} />)

    expect(screen.getByText('Bank Data Freshness')).toBeInTheDocument()
    expect(screen.getByText('Delayed Sync')).toBeInTheDocument()
    expect(screen.getByText(/Bank data has not synchronized in 48 hours/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Manage Bank Accounts/i })).toHaveAttribute('href', '/connected-accounts')
  })

  it('shows DataSufficiencyBanner when data sufficiency is INSUFFICIENT', () => {
    renderWithClient(
      <DataSufficiencyBanner
        sufficiency="INSUFFICIENT"
        summary="Assessment is limited due to low transaction volume."
      />
    )

    expect(screen.getByText('Building Financial Health Baseline')).toBeInTheDocument()
    expect(screen.getByText('INSUFFICIENT')).toBeInTheDocument()
    expect(screen.getByText('Assessment is limited due to low transaction volume.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Add Transaction/i })).toBeInTheDocument()
  })

  it('renders DashboardFinancialHealthCard on Dashboard with summary and top action', async () => {
    vi.spyOn(financialHealthService, 'getFinancialHealth').mockResolvedValue(mockHealthData)

    renderWithClient(<DashboardFinancialHealthCard />)

    await waitFor(() => {
      expect(screen.getByText('Financial Health Assessment')).toBeInTheDocument()
    })

    expect(screen.getByText('Attention Required')).toBeInTheDocument()
    expect(screen.getByText('Buffer Breach Forecasted')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View Full Assessment/i })).toHaveAttribute('href', '/financial-health')
  })

  it('handles error state with retry button on FinancialHealthPage', async () => {
    const spy = vi
      .spyOn(financialHealthService, 'getFinancialHealth')
      .mockRejectedValueOnce(new Error('Network connection timeout'))
      .mockResolvedValueOnce(mockHealthData)

    renderWithClient(<FinancialHealthPage />)

    await waitFor(() => {
      expect(screen.getByText(/Unable to load financial health assessment/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /Try Again/i })
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Financial Health/i })).toBeInTheDocument()
    })

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
