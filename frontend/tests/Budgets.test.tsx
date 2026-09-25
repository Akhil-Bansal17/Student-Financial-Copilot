import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { OverallBudgetCard } from '@/components/budgets/OverallBudgetCard'
import { CategoryBudgetCard } from '@/components/budgets/CategoryBudgetCard'
import { BudgetFormSheet } from '@/components/budgets/BudgetFormSheet'
import { DashboardBudgetOverview } from '@/components/budgets/DashboardBudgetOverview'
import { budgetService } from '@/services/budgetService'
import { authService, tokenStorage } from '@/services/authService'
import type { BudgetSummary, BudgetCategorySummary } from '@/types/budget'
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

const mockEmptySummary: BudgetSummary = {
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
}

const mockPopulatedSummary: BudgetSummary = {
  year: 2026,
  month: 9,
  currency: 'INR',
  overall_budget: '10000.00',
  overall_budget_id: 101,
  overall_spending: '4200.00',
  overall_remaining: '5800.00',
  overall_utilization: '42.0',
  overall_over_budget: false,
  overall: {
    id: 101,
    budget: '10000.00',
    spent: '4200.00',
    remaining: '5800.00',
    utilization: '42.0',
    over_budget: false,
  },
  category_budgets: [
    {
      id: 201,
      category: 'Food',
      budget: '3000.00',
      spent: '2100.00',
      remaining: '900.00',
      utilization: '70.0',
      over_budget: false,
    },
    {
      id: 202,
      category: 'Entertainment',
      budget: '1000.00',
      spent: '1250.00',
      remaining: '-250.00',
      utilization: '125.0',
      over_budget: true,
    },
  ],
  has_overall_budget: true,
  total_categories_budgeted: 2,
  has_any_budget: true,
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

describe('Phase 4 - Budgets & Spending Limits Frontend Suite', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-jwt-token')
    vi.restoreAllMocks()
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
  })

  // -------------------------------------------------------------------------
  // 1. BudgetsPage & Empty States
  // -------------------------------------------------------------------------
  describe('1. BudgetsPage Rendering & States', () => {
    it('renders empty budget states when no budgets are configured', async () => {
      vi.spyOn(budgetService, 'getBudgetSummary').mockResolvedValue(mockEmptySummary)

      renderWithProviders(<BudgetsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Budgets & Spending Limits/i)).toBeInTheDocument()
      })

      // Overall empty state (wait for query to resolve)
      await waitFor(() => {
        expect(screen.getByText(/No Overall Budget Set/i)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Set Monthly Budget/i })).toBeInTheDocument()

      // Category empty state
      expect(screen.getByText(/No category budgets set for this month/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Create Category Budget/i })).toBeInTheDocument()
    })

    it('renders populated budget summary with overall and category cards', async () => {
      vi.spyOn(budgetService, 'getBudgetSummary').mockResolvedValue(mockPopulatedSummary)

      renderWithProviders(<BudgetsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Overall Spending Limit/i)).toBeInTheDocument()
      })

      // Overall metrics
      expect(screen.getByText(/42% Used/i)).toBeInTheDocument()

      // Category cards
      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Entertainment')).toBeInTheDocument()
      expect(screen.getByText(/Over Budget/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 2. OverallBudgetCard Component
  // -------------------------------------------------------------------------
  describe('2. OverallBudgetCard Component', () => {
    it('displays under-budget calculations and progress correctly', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onSetBudget = vi.fn()

      renderWithProviders(
        <OverallBudgetCard
          overallBudget="10000.00"
          overallBudgetId={101}
          overallSpending="4200.00"
          overallRemaining="5800.00"
          overallUtilization="42.0"
          overallOverBudget={false}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetBudget={onSetBudget}
        />
      )

      expect(screen.getByText(/Overall Spending Limit/i)).toBeInTheDocument()
      expect(screen.getByText(/42% Used/i)).toBeInTheDocument()
      expect(screen.getByText(/42.0%/i)).toBeInTheDocument()

      // Edit click
      const editBtn = screen.getByRole('button', { name: /Edit overall budget/i })
      fireEvent.click(editBtn)
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('displays over-budget badge and negative remaining amount', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()
      const onSetBudget = vi.fn()

      renderWithProviders(
        <OverallBudgetCard
          overallBudget="3000.00"
          overallBudgetId={102}
          overallSpending="3400.00"
          overallRemaining="-400.00"
          overallUtilization="113.3"
          overallOverBudget={true}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetBudget={onSetBudget}
        />
      )

      expect(screen.getByText(/Over Budget/i)).toBeInTheDocument()
      expect(screen.getByText(/113.3%/i)).toBeInTheDocument()
      // Negative remaining displayed in negative currency format
      expect(screen.getByText(/-₹400.00/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 3. CategoryBudgetCard Component
  // -------------------------------------------------------------------------
  describe('3. CategoryBudgetCard Component', () => {
    const foodSummary: BudgetCategorySummary = {
      id: 201,
      category: 'Food',
      budget: '3000.00',
      spent: '2100.00',
      remaining: '900.00',
      utilization: '70.0',
      over_budget: false,
    }

    const entSummary: BudgetCategorySummary = {
      id: 202,
      category: 'Entertainment',
      budget: '1000.00',
      spent: '1250.00',
      remaining: '-250.00',
      utilization: '125.0',
      over_budget: true,
    }

    it('renders category stats and triggers edit/delete handlers', async () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn().mockResolvedValue(undefined)

      renderWithProviders(
        <CategoryBudgetCard
          summary={foodSummary}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )

      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText(/70(\.0)?% used/i)).toBeInTheDocument()

      // Click Edit
      fireEvent.click(screen.getByRole('button', { name: /Edit Food budget/i }))
      expect(onEdit).toHaveBeenCalledTimes(1)

      // Click Delete opens inline confirmation
      fireEvent.click(screen.getByRole('button', { name: /Delete Food budget/i }))
      expect(screen.getByText('Delete')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()

      // Confirm delete
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith(201)
      })
    })

    it('shows Over Budget badge for over-budget category', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn()

      renderWithProviders(
        <CategoryBudgetCard
          summary={entSummary}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )

      expect(screen.getByText('Entertainment')).toBeInTheDocument()
      expect(screen.getByText(/Over Budget/i)).toBeInTheDocument()
      expect(screen.getByText(/-₹250.00/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 4. BudgetFormSheet & Validations
  // -------------------------------------------------------------------------
  describe('4. BudgetFormSheet Component', () => {
    it('validates empty and non-positive budget amount inputs', async () => {
      const onClose = vi.fn()
      const onSuccess = vi.fn()

      renderWithProviders(
        <BudgetFormSheet
          isOpen={true}
          onClose={onClose}
          defaultYear={2026}
          defaultMonth={9}
          onSuccess={onSuccess}
        />
      )

      expect(screen.getByText(/Set Spending Budget/i)).toBeInTheDocument()

      // Clear input and submit
      const input = screen.getByLabelText(/Spending Limit/i)
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.submit(input.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText(/Please enter a budget amount/i)).toBeInTheDocument()
      })

      // Zero amount
      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.submit(input.closest('form')!)

      await waitFor(() => {
        expect(
          screen.getByText(/Budget amount must be a positive number greater than ₹0/i)
        ).toBeInTheDocument()
      })
    })

    it('successfully submits a new overall budget', async () => {
      const createSpy = vi.spyOn(budgetService, 'createBudget').mockResolvedValue({
        id: 301,
        user_id: 1,
        year: 2026,
        month: 9,
        category: null,
        amount: '8000.00',
        created_at: '2026-09-25T00:00:00Z',
        updated_at: '2026-09-25T00:00:00Z',
        actual_spending: '0.00',
        remaining: '8000.00',
        utilization_percentage: '0.0',
        over_budget: false,
      })

      const onClose = vi.fn()
      const onSuccess = vi.fn()

      renderWithProviders(
        <BudgetFormSheet
          isOpen={true}
          onClose={onClose}
          defaultYear={2026}
          defaultMonth={9}
          onSuccess={onSuccess}
        />
      )

      const input = screen.getByLabelText(/Spending Limit/i)
      fireEvent.change(input, { target: { value: '8000' } })

      const submitBtn = screen.getByRole('button', { name: /Set Budget/i })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          year: 2026,
          month: 9,
          category: null,
          amount: '8000.00',
        })
        expect(onSuccess).toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('submits a category budget when switched to category mode', async () => {
      const createSpy = vi.spyOn(budgetService, 'createBudget').mockResolvedValue({
        id: 302,
        user_id: 1,
        year: 2026,
        month: 9,
        category: 'Food',
        amount: '3500.00',
        created_at: '2026-09-25T00:00:00Z',
        updated_at: '2026-09-25T00:00:00Z',
        actual_spending: '0.00',
        remaining: '3500.00',
        utilization_percentage: '0.0',
        over_budget: false,
      })

      const onClose = vi.fn()
      const onSuccess = vi.fn()

      renderWithProviders(
        <BudgetFormSheet
          isOpen={true}
          onClose={onClose}
          defaultYear={2026}
          defaultMonth={9}
          onSuccess={onSuccess}
        />
      )

      // Click Category Specific
      fireEvent.click(screen.getByText(/Category Specific/i))

      // Amount
      const input = screen.getByLabelText(/Spending Limit/i)
      fireEvent.change(input, { target: { value: '3500' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Set Budget/i }))

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          year: 2026,
          month: 9,
          category: 'Food',
          amount: '3500.00',
        })
      })
    })
  })

  // -------------------------------------------------------------------------
  // 5. DashboardBudgetOverview Component
  // -------------------------------------------------------------------------
  describe('5. DashboardBudgetOverview Component', () => {
    it('renders empty state when no budget is set for current month', async () => {
      vi.spyOn(budgetService, 'getBudgetSummary').mockResolvedValue(mockEmptySummary)

      renderWithProviders(<DashboardBudgetOverview year={2026} month={9} />)

      await waitFor(() => {
        expect(screen.getByText(/No budget set for this month/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Set Budget/i })).toBeInTheDocument()
    })

    it('renders compact overview with link to /budgets when budget exists', async () => {
      vi.spyOn(budgetService, 'getBudgetSummary').mockResolvedValue(mockPopulatedSummary)

      renderWithProviders(<DashboardBudgetOverview year={2026} month={9} />)

      await waitFor(() => {
        expect(screen.getByText(/Monthly Budget Overview/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('link', { name: /Manage Budgets/i })).toHaveAttribute(
        'href',
        '/budgets'
      )
      expect(screen.getByText(/42.0%/i)).toBeInTheDocument()
    })
  })
})
