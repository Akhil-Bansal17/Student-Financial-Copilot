import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { CopilotPage } from '@/pages/CopilotPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { copilotService } from '@/services/copilotService'
import { transactionService } from '@/services/transactionService'
import { analyticsService } from '@/services/analyticsService'
import { budgetService } from '@/services/budgetService'
import { goalService } from '@/services/goalService'
import { insightService } from '@/services/insightService'
import { authService, tokenStorage } from '@/services/authService'
import type { CopilotChatResponse } from '@/types/copilot'
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

const mockCopilotResponse: CopilotChatResponse = {
  answer:
    'You have spent **₹4,200.00** on **Food** this month across 3 transactions. This accounts for **52.5%** of your total monthly expenses.',
  period: '2026-09',
  has_sufficient_data: true,
  context_used: {
    period: '2026-09',
    monthly_expenses: '4200.00',
    top_spending_category: 'Food',
    active_goals_count: 1,
    has_sufficient_data: true,
  },
}

function renderCopilotPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CopilotPage />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('AI Financial Copilot (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tokenStorage.setToken('test-token')
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
    // Mock scrollIntoView in jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    })
  })

  it('1. Renders Copilot page header and badge', async () => {
    renderCopilotPage()

    expect(screen.getByRole('heading', { name: /financial copilot/i })).toBeInTheDocument()
    expect(screen.getByText(/ledger grounded/i)).toBeInTheDocument()
    expect(screen.getByText(/how can i help with your finances today/i)).toBeInTheDocument()
  })

  it('2. Displays suggested question chips in empty state', async () => {
    renderCopilotPage()

    expect(screen.getByText('Summarize my finances this month')).toBeInTheDocument()
    expect(screen.getByText('Where did most of my money go?')).toBeInTheDocument()
    expect(screen.getByText('Am I close to any budget limits?')).toBeInTheDocument()
    expect(screen.getByText('How are my savings goals going?')).toBeInTheDocument()
    expect(screen.getByText('What changed this month?')).toBeInTheDocument()
    expect(screen.getByText('Explain my biggest spending pattern')).toBeInTheDocument()
  })

  it('3. Submits a suggested prompt on click and renders user message + AI response', async () => {
    const sendSpy = vi.spyOn(copilotService, 'sendMessage').mockResolvedValue(mockCopilotResponse)

    renderCopilotPage()

    const promptBtn = screen.getByText('Where did most of my money go?')
    fireEvent.click(promptBtn)

    // User message is rendered
    expect(screen.getByText('Where did most of my money go?')).toBeInTheDocument()

    // API called with message and period
    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Where did most of my money go?',
        })
      )
    })

    // AI response rendered
    await waitFor(() => {
      expect(screen.getByText(/You have spent/i)).toBeInTheDocument()
      expect(screen.getByText('₹4,200.00')).toBeInTheDocument()
    })
  })

  it('4. Submits text message from input and clears input field', async () => {
    const sendSpy = vi.spyOn(copilotService, 'sendMessage').mockResolvedValue(mockCopilotResponse)

    renderCopilotPage()

    const input = screen.getByPlaceholderText(/ask about your/i)
    const sendBtn = screen.getByRole('button', { name: /ask/i })

    // Button disabled when input empty
    expect(sendBtn).toBeDisabled()

    // Type query
    fireEvent.change(input, { target: { value: 'How much did I spend on food?' } })
    expect(sendBtn).not.toBeDisabled()

    fireEvent.click(sendBtn)

    expect(screen.getByText('How much did I spend on food?')).toBeInTheDocument()
    expect(input).toHaveValue('')

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How much did I spend on food?',
        })
      )
    })
  })

  it('5. Handles API error gracefully with Retry button', async () => {
    vi.spyOn(copilotService, 'sendMessage').mockRejectedValue(new Error('Network error'))

    renderCopilotPage()

    const input = screen.getByPlaceholderText(/ask about your/i)
    const sendBtn = screen.getByRole('button', { name: /ask/i })

    fireEvent.change(input, { target: { value: 'Why did my balance decrease?' } })
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText(/Unable to reach the Financial Copilot/i)).toBeInTheDocument()
      expect(screen.getByText(/Retry Question/i)).toBeInTheDocument()
    })
  })

  it('6. Clears conversation when Clear button is clicked', async () => {
    vi.spyOn(copilotService, 'sendMessage').mockResolvedValue(mockCopilotResponse)

    renderCopilotPage()

    const promptBtn = screen.getByText('Summarize my finances this month')
    fireEvent.click(promptBtn)

    await waitFor(() => {
      expect(screen.getByText('Summarize my finances this month')).toBeInTheDocument()
    })

    // Clear button should be visible now
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    fireEvent.click(clearBtn)

    // Back to empty state
    expect(screen.getByText(/how can i help with your finances today/i)).toBeInTheDocument()
  })

  it('7. Copies AI response text when Copy button is clicked', async () => {
    vi.spyOn(copilotService, 'sendMessage').mockResolvedValue(mockCopilotResponse)

    renderCopilotPage()

    const promptBtn = screen.getByText('Summarize my finances this month')
    fireEvent.click(promptBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })

    const copyBtn = screen.getByRole('button', { name: /copy/i })
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCopilotResponse.answer)
  })

  it('8. Dashboard renders "Ask your Financial Copilot" card linking to /copilot', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    // Mock dashboard queries
    vi.spyOn(transactionService, 'getSummary').mockResolvedValue({
      starting_balance: '10000.00',
      current_balance: '15000.00',
      total_income: '20000.00',
      total_expenses: '5000.00',
      net_cash_flow: '15000.00',
      currency: 'INR',
    })
    vi.spyOn(analyticsService, 'getMonthly').mockResolvedValue({
      year: 2026,
      month: 9,
      monthly_income: '20000.00',
      monthly_expenses: '5000.00',
      monthly_net_cash_flow: '15000.00',
      transaction_count: 5,
      previous_month_income: '18000.00',
      previous_month_expenses: '4500.00',
      previous_month_net_cash_flow: '13500.00',
      income_change_percentage: '11.1',
      expense_change_percentage: '11.1',
      net_cash_flow_change_percentage: '11.1',
    })
    vi.spyOn(analyticsService, 'getCategories').mockResolvedValue({
      year: 2026,
      month: 9,
      total_expenses: '5000.00',
      items: [],
    })
    vi.spyOn(analyticsService, 'getTrend').mockResolvedValue({
      year: 2026,
      month: 9,
      days: [],
    })
    vi.spyOn(budgetService, 'getBudgetSummary').mockResolvedValue({
      year: 2026,
      month: 9,
      currency: 'INR',
      overall_budget: null,
      overall_budget_id: null,
      overall_spending: '0.00',
      overall_remaining: null,
      overall_utilization: null,
      overall_over_budget: false,
      overall: null,
      category_budgets: [],
      has_overall_budget: false,
      total_categories_budgeted: 0,
      has_any_budget: false,
    })
    vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue({
      total_goals_count: 0,
      active_goals_count: 0,
      completed_goals_count: 0,
      overdue_goals_count: 0,
      total_target_amount: '0.00',
      total_saved_amount: '0.00',
      overall_progress_percentage: '0.0',
      goals: [],
    })
    vi.spyOn(insightService, 'getInsights').mockResolvedValue({
      year: 2026,
      month: 9,
      period: '2026-09',
      has_sufficient_data: true,
      summary: {
        total_insights_count: 0,
        positive_count: 0,
        warning_count: 0,
        info_count: 0,
        has_sufficient_data: true,
      },
      insights: [],
    })
    vi.spyOn(transactionService, 'getTransactions').mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Ask your Financial Copilot')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /ask copilot/i })).toHaveAttribute(
        'href',
        '/copilot'
      )
    })
  })
})
