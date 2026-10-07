import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { PersonalizationPage } from '@/pages/PersonalizationPage'
import { FinancialFocusCard } from '@/components/personalization/FinancialFocusCard'
import { BehavioralSignalsCard } from '@/components/personalization/BehavioralSignalsCard'
import { PersonalizationSettingsForm } from '@/components/personalization/PersonalizationSettingsForm'
import { personalizationService } from '@/services/personalizationService'
import type {
  PersonalizationProfile,
  BehavioralSignalsResponse,
  EffectivePersonalizationConfig,
} from '@/types'

const mockProfile: PersonalizationProfile = {
  id: 1,
  user_id: 1,
  is_personalization_enabled: true,
  alert_sensitivity: 'BALANCED',
  financial_priority: 'BUILD_BUFFER',
  large_transaction_threshold: null,
  recurring_alert_days_before: 3,
  created_at: '2026-10-05T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
}

const mockSignals: BehavioralSignalsResponse = {
  data_sufficiency: 'MODERATE',
  transaction_count: 24,
  analyzed_period_months: 3,
  typical_transaction_amount: '350.00',
  average_transaction_amount: '420.00',
  calculated_large_threshold: '1250.00',
  frequent_merchants: [
    {
      merchant_name: 'Swiggy',
      transaction_count: 8,
      total_spend: '2800.00',
      average_amount: '350.00',
      category: 'Food',
      frequency_share_pct: 32.5,
    },
    {
      merchant_name: 'Uber',
      transaction_count: 5,
      total_spend: '1100.00',
      average_amount: '220.00',
      category: 'Transport',
      frequency_share_pct: 12.8,
    },
  ],
  frequent_categories: [
    {
      category: 'Food',
      total_spend: '4200.00',
      percentage: 48.5,
      transaction_count: 12,
    },
    {
      category: 'Transport',
      total_spend: '1500.00',
      percentage: 17.3,
      transaction_count: 6,
    },
  ],
  spending_timing: {
    weekend_spend_percentage: 42.0,
    weekday_spend_percentage: 58.0,
    month_start_spend_percentage: 35.0,
    month_mid_spend_percentage: 40.0,
    month_end_spend_percentage: 25.0,
    timing_observation: 'Spending is well distributed across weekdays with moderate spikes on weekends.',
  },
  signals_summary: 'Sufficient sample history exists for baseline calculations.',
  generated_at: '2026-10-05T12:00:00Z',
}

const mockEffective: EffectivePersonalizationConfig = {
  is_personalization_enabled: true,
  alert_sensitivity: 'BALANCED',
  financial_priority: 'BUILD_BUFFER',
  effective_large_transaction_threshold: '1250.00',
  is_custom_large_threshold: false,
  recurring_alert_days_before: 3,
  minimum_balance_threshold: '2000.00',
  minimum_balance_source: 'ForecastPreference',
  data_sufficiency: 'MODERATE',
  priority_focus_description:
    'Focusing on building and preserving your safety cash buffer against unexpected deficits and recurring charges.',
  top_recommended_action: {
    id: 'act_buffer_1',
    title: 'Maintain Minimum Safety Buffer',
    description: 'Ensure at least ₹2,000 remains in your account to avoid low-balance alerts.',
    priority: 'HIGH',
    action_url: '/forecast',
    reason: 'Buffer preservation',
  },
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Personalization & Adaptive Intelligence (Phase 16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(personalizationService, 'getProfile').mockResolvedValue(mockProfile)
    vi.spyOn(personalizationService, 'getBehavioralSignals').mockResolvedValue(mockSignals)
    vi.spyOn(personalizationService, 'getEffectiveConfig').mockResolvedValue(mockEffective)
    vi.spyOn(personalizationService, 'updateProfile').mockResolvedValue(mockProfile)
  })

  it('renders FinancialFocusCard with priority and top recommended action', async () => {
    renderWithClient(<FinancialFocusCard />)

    expect(await screen.findByTestId('financial-focus-card')).toBeInTheDocument()
    expect(screen.getByText('Your Financial Focus')).toBeInTheDocument()
    expect(screen.getByText('Build Cash Buffer')).toBeInTheDocument()
    expect(screen.getByText('MODERATE EVIDENCE')).toBeInTheDocument()
    expect(screen.getByText(/Maintain Minimum Safety Buffer/i)).toBeInTheDocument()
    expect(screen.getByText('Take Action')).toBeInTheDocument()
  })

  it('renders BehavioralSignalsCard with baselines, merchants, and timing', async () => {
    renderWithClient(<BehavioralSignalsCard />)

    expect(await screen.findByTestId('behavioral-signals-card')).toBeInTheDocument()
    expect(screen.getByText('Observed Behavioral Intelligence')).toBeInTheDocument()
    expect(screen.getByText('MODERATE Evidence')).toBeInTheDocument()
    expect(screen.getByText('Swiggy')).toBeInTheDocument()
    expect(screen.getByText('Uber')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('58%')).toBeInTheDocument()
  })

  it('renders PersonalizationSettingsForm with all controls populated', async () => {
    renderWithClient(<PersonalizationSettingsForm />)

    expect(await screen.findByTestId('personalization-settings-form')).toBeInTheDocument()
    expect(screen.getByLabelText(/Adaptive Financial Personalization/i)).toBeChecked()
    expect(screen.getByText('Build Cash Buffer')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('3 Days Prior')).toBeInTheDocument()
  })

  it('updates priority and sensitivity when user selects new options and saves', async () => {
    const updateSpy = vi.spyOn(personalizationService, 'updateProfile').mockResolvedValue({
      ...mockProfile,
      financial_priority: 'CONTROL_SPENDING',
      alert_sensitivity: 'CONSERVATIVE',
    })

    renderWithClient(<PersonalizationSettingsForm />)

    await screen.findByTestId('personalization-settings-form')

    // Click on "Control Spending" priority card
    const controlSpendingBtn = screen.getByText('Control Spending').closest('button')
    if (controlSpendingBtn) {
      fireEvent.click(controlSpendingBtn)
    }

    // Click on "Conservative" sensitivity
    const conservativeBtn = screen.getByText('Conservative').closest('button')
    if (conservativeBtn) {
      fireEvent.click(conservativeBtn)
    }

    // Click on "5 Days Prior" recurring timing
    const fiveDaysBtn = screen.getByText('5 Days Prior')
    fireEvent.click(fiveDaysBtn)

    // Save preferences
    const saveBtn = screen.getByTestId('save-personalization-btn')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          financial_priority: 'CONTROL_SPENDING',
          alert_sensitivity: 'CONSERVATIVE',
          recurring_alert_days_before: 5,
        })
      )
    })

    expect(await screen.findByTestId('save-success-banner')).toBeInTheDocument()
  })

  it('allows specifying custom large transaction threshold with validation', async () => {
    const updateSpy = vi.spyOn(personalizationService, 'updateProfile').mockResolvedValue(mockProfile)

    renderWithClient(<PersonalizationSettingsForm />)

    // Wait for initial profile data to settle
    expect(await screen.findByText('Build Cash Buffer')).toBeInTheDocument()

    // Toggle custom threshold checkbox
    const customToggle = screen.getByTestId('custom-large-toggle')
    fireEvent.click(customToggle)

    // Enter valid threshold
    const input = await screen.findByTestId('custom-threshold-input')
    fireEvent.change(input, { target: { value: '4500' } })

    const saveBtn = screen.getByTestId('save-personalization-btn')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          large_transaction_threshold: 4500,
        })
      )
    })
  })

  it('renders PersonalizationPage with tab switching between settings and signals', async () => {
    renderWithClient(<PersonalizationPage />)

    expect(await screen.findByTestId('personalization-page')).toBeInTheDocument()
    expect(screen.getByText('Financial Personalization & Adaptive Intelligence')).toBeInTheDocument()
    expect(screen.getByTestId('tab-settings')).toBeInTheDocument()
    expect(screen.getByTestId('tab-signals')).toBeInTheDocument()

    // Switch to Signals tab
    fireEvent.click(screen.getByTestId('tab-signals'))
    expect(await screen.findByTestId('behavioral-signals-card')).toBeInTheDocument()

    // Switch back to Settings tab
    fireEvent.click(screen.getByTestId('tab-settings'))
    expect(await screen.findByTestId('personalization-settings-form')).toBeInTheDocument()
  })

  it('resets personalization settings when reset button is clicked', async () => {
    const defaultProfile: PersonalizationProfile = {
      id: 1,
      user_id: 1,
      is_personalization_enabled: true,
      alert_sensitivity: 'BALANCED',
      financial_priority: 'BALANCED',
      large_transaction_threshold: null,
      recurring_alert_days_before: 3,
      created_at: '2026-10-05T00:00:00Z',
      updated_at: '2026-10-05T00:00:00Z',
    }
    const resetSpy = vi.spyOn(personalizationService, 'resetProfile').mockResolvedValue(defaultProfile)

    renderWithClient(<PersonalizationSettingsForm />)

    expect(await screen.findByTestId('personalization-settings-form')).toBeInTheDocument()

    const resetBtn = screen.getByTestId('reset-personalization-btn')
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalled()
    })

    expect(await screen.findByTestId('reset-success-banner')).toBeInTheDocument()
  })

  it('renders BehavioralSignalsCard gracefully when data sufficiency is INSUFFICIENT', async () => {
    vi.spyOn(personalizationService, 'getBehavioralSignals').mockResolvedValue({
      data_sufficiency: 'INSUFFICIENT',
      transaction_count: 0,
      analyzed_period_months: 1,
      typical_transaction_amount: '0.00',
      average_transaction_amount: '0.00',
      calculated_large_threshold: '2000.00',
      frequent_merchants: [],
      frequent_categories: [],
      spending_timing: {
        weekend_spend_percentage: 0,
        weekday_spend_percentage: 0,
        month_start_spend_percentage: 0,
        month_mid_spend_percentage: 0,
        month_end_spend_percentage: 0,
        timing_observation: 'Insufficient transaction records to determine reliable timing patterns.',
      },
      signals_summary: 'Add more transactions to unlock deeper behavioral personalization.',
      generated_at: '2026-10-05T12:00:00Z',
    })

    renderWithClient(<BehavioralSignalsCard />)

    expect(await screen.findByTestId('behavioral-signals-card')).toBeInTheDocument()
    expect(screen.getByText('INSUFFICIENT Evidence')).toBeInTheDocument()
    expect(screen.getByText('No recurrent merchant patterns detected yet.')).toBeInTheDocument()
    expect(screen.getByText('Insufficient expense transactions recorded.')).toBeInTheDocument()
  })

  it('renders error card when profile fails to load', async () => {
    vi.spyOn(personalizationService, 'getProfile').mockRejectedValue(new Error('Network error'))

    renderWithClient(<PersonalizationSettingsForm />)

    expect(await screen.findByText('Could not load preferences')).toBeInTheDocument()
  })
})

