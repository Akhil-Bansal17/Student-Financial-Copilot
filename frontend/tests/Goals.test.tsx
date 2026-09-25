import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { GoalsPage } from '@/pages/GoalsPage'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormSheet } from '@/components/goals/GoalFormSheet'
import { ContributeSheet } from '@/components/goals/ContributeSheet'
import { DashboardGoalsOverview } from '@/components/goals/DashboardGoalsOverview'
import { goalService } from '@/services/goalService'
import { authService, tokenStorage } from '@/services/authService'
import type { Goal, GoalsOverview } from '@/types/goal'
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

const mockGoalActive: Goal = {
  id: 1,
  user_id: 1,
  name: 'New Laptop',
  description: 'Upgrade for coding and assignments',
  target_amount: '50000.00',
  current_amount: '20000.00',
  remaining_amount: '30000.00',
  progress_percentage: '40.0',
  status: 'active',
  target_date: '2026-12-31',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  contributions: [
    {
      id: 101,
      goal_id: 1,
      user_id: 1,
      amount: '20000.00',
      note: 'Stipend savings',
      created_at: '2026-09-21T10:00:00Z',
    },
  ],
}

const mockGoalCompleted: Goal = {
  id: 2,
  user_id: 1,
  name: 'Textbook Fund',
  description: 'Semester 5 books',
  target_amount: '4000.00',
  current_amount: '4000.00',
  remaining_amount: '0.00',
  progress_percentage: '100.0',
  status: 'completed',
  target_date: '2026-10-01',
  created_at: '2026-09-15T10:00:00Z',
  updated_at: '2026-09-22T10:00:00Z',
  contributions: [
    {
      id: 102,
      goal_id: 2,
      user_id: 1,
      amount: '4000.00',
      note: 'Part-time tutor pay',
      created_at: '2026-09-22T10:00:00Z',
    },
  ],
}

const mockGoalOverdue: Goal = {
  id: 3,
  user_id: 1,
  name: 'Hackathon Travel',
  description: null,
  target_amount: '5000.00',
  current_amount: '2500.00',
  remaining_amount: '2500.00',
  progress_percentage: '50.0',
  status: 'overdue',
  target_date: '2026-08-15',
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-10T10:00:00Z',
  contributions: [],
}

const mockOverview: GoalsOverview = {
  total_goals_count: 3,
  active_goals_count: 1,
  completed_goals_count: 1,
  overdue_goals_count: 1,
  total_target_amount: '59000.00',
  total_saved_amount: '26500.00',
  overall_progress_percentage: '44.9',
  goals: [mockGoalActive, mockGoalCompleted, mockGoalOverdue],
}

const mockEmptyOverview: GoalsOverview = {
  total_goals_count: 0,
  active_goals_count: 0,
  completed_goals_count: 0,
  overdue_goals_count: 0,
  total_target_amount: '0.00',
  total_saved_amount: '0.00',
  overall_progress_percentage: '0.0',
  goals: [],
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

describe('Phase 5: Financial Goals & Savings Targets', () => {
  beforeEach(() => {
    tokenStorage.setToken('mock-test-jwt-token')
    vi.restoreAllMocks()
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockUser)
  })

  describe('GoalsPage', () => {
    it('renders empty state when user has no goals', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockEmptyOverview)
      vi.spyOn(goalService, 'getGoals').mockResolvedValue([])

      renderWithProviders(<GoalsPage />)

      await waitFor(() => {
        expect(screen.getByText(/No savings goals created yet/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/Create Your First Goal/i)).toBeInTheDocument()
    })

    it('renders populated goals overview and cards', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockOverview)
      vi.spyOn(goalService, 'getGoals').mockResolvedValue([
        mockGoalActive,
        mockGoalCompleted,
        mockGoalOverdue,
      ])

      renderWithProviders(<GoalsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Laptop')).toBeInTheDocument()
      })

      expect(screen.getByText('Textbook Fund')).toBeInTheDocument()
      expect(screen.getByText('Hackathon Travel')).toBeInTheDocument()
      expect(screen.getByText(/44.9% Overall/i)).toBeInTheDocument()
      expect(screen.getByText('Goals Reached')).toBeInTheDocument()
    })

    it('filters goals when status filter tabs are clicked', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockOverview)
      const getGoalsSpy = vi
        .spyOn(goalService, 'getGoals')
        .mockResolvedValueOnce([mockGoalActive, mockGoalCompleted, mockGoalOverdue])
        .mockResolvedValueOnce([mockGoalCompleted])

      renderWithProviders(<GoalsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Laptop')).toBeInTheDocument()
      })

      const completedTab = screen.getByRole('button', { name: /Completed/i })
      fireEvent.click(completedTab)

      await waitFor(() => {
        expect(getGoalsSpy).toHaveBeenCalledWith('completed')
      })
    })

    it('opens create goal sheet when clicking New Goal button', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockOverview)
      vi.spyOn(goalService, 'getGoals').mockResolvedValue([mockGoalActive])

      renderWithProviders(<GoalsPage />)

      await waitFor(() => {
        expect(screen.getByText('New Laptop')).toBeInTheDocument()
      })

      const newGoalBtn = screen.getByRole('button', { name: /New Goal/i })
      fireEvent.click(newGoalBtn)

      expect(screen.getByText('New Savings Goal')).toBeInTheDocument()
      expect(screen.getByLabelText(/Goal Title/i)).toBeInTheDocument()
    })
  })

  describe('GoalCard', () => {
    it('renders active goal correctly with Add Money button', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onContribute = vi.fn()

      render(
        <GoalCard
          goal={mockGoalActive}
          onEdit={onEdit}
          onDelete={onDelete}
          onContribute={onContribute}
        />
      )

      expect(screen.getByText('New Laptop')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('40%')).toBeInTheDocument()

      const addMoneyBtn = screen.getByRole('button', { name: /Add Money/i })
      expect(addMoneyBtn).toBeEnabled()
      fireEvent.click(addMoneyBtn)
      expect(onContribute).toHaveBeenCalledTimes(1)
    })

    it('renders completed goal with badge and disabled Goal Reached button', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onContribute = vi.fn()

      render(
        <GoalCard
          goal={mockGoalCompleted}
          onEdit={onEdit}
          onDelete={onDelete}
          onContribute={onContribute}
        />
      )

      expect(screen.getByText('Textbook Fund')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Target Reached')).toBeInTheDocument()

      const reachedBtn = screen.getByRole('button', { name: /Goal Reached!/i })
      expect(reachedBtn).toBeDisabled()
    })

    it('renders overdue goal with Overdue badge', () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onContribute = vi.fn()

      render(
        <GoalCard
          goal={mockGoalOverdue}
          onEdit={onEdit}
          onDelete={onDelete}
          onContribute={onContribute}
        />
      )

      expect(screen.getByText('Hackathon Travel')).toBeInTheDocument()
      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('handles delete confirmation flow', async () => {
      const onEdit = vi.fn()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onContribute = vi.fn()

      render(
        <GoalCard
          goal={mockGoalActive}
          onEdit={onEdit}
          onDelete={onDelete}
          onContribute={onContribute}
        />
      )

      const deleteIconBtn = screen.getByRole('button', { name: /Delete New Laptop/i })
      fireEvent.click(deleteIconBtn)

      const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete' })
      expect(confirmDeleteBtn).toBeInTheDocument()

      fireEvent.click(confirmDeleteBtn)
      expect(onDelete).toHaveBeenCalledWith(mockGoalActive.id)
    })
  })

  describe('GoalFormSheet', () => {
    it('validates target amount must be positive', async () => {
      renderWithProviders(
        <GoalFormSheet
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      const nameInput = screen.getByLabelText(/Goal Title/i)
      const amountInput = screen.getByLabelText(/Target Amount/i)

      fireEvent.change(nameInput, { target: { value: 'Valid Name' } })
      fireEvent.change(amountInput, { target: { value: '0' } })
      fireEvent.submit(amountInput.closest('form')!)

      await waitFor(() => {
        expect(
          screen.getByText(/Target amount must be a positive number greater than ₹0/i)
        ).toBeInTheDocument()
      })
    })

    it('submits valid new goal', async () => {
      const createSpy = vi.spyOn(goalService, 'createGoal').mockResolvedValue(mockGoalActive)
      const onClose = vi.fn()

      renderWithProviders(
        <GoalFormSheet
          isOpen={true}
          onClose={onClose}
        />
      )

      const nameInput = screen.getByLabelText(/Goal Title/i)
      const amountInput = screen.getByLabelText(/Target Amount/i)

      fireEvent.change(nameInput, { target: { value: 'New Laptop' } })
      fireEvent.change(amountInput, { target: { value: '50000' } })
      fireEvent.submit(amountInput.closest('form')!)

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          name: 'New Laptop',
          description: null,
          target_amount: '50000.00',
          target_date: null,
        })
      })
    })
  })

  describe('ContributeSheet', () => {
    it('prevents contribution amount exceeding remaining goal amount', async () => {
      vi.spyOn(goalService, 'getGoalContributions').mockResolvedValue([])

      renderWithProviders(
        <ContributeSheet
          isOpen={true}
          onClose={vi.fn()}
          goal={mockGoalActive} // remaining is 30000.00
        />
      )

      const amountInput = screen.getByPlaceholderText(/e\.g\. 2000/i)

      fireEvent.change(amountInput, { target: { value: '35000' } })
      fireEvent.submit(amountInput.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText(/exceeds remaining target/i)).toBeInTheDocument()
      })
    })

    it('submits valid contribution', async () => {
      vi.spyOn(goalService, 'getGoalContributions').mockResolvedValue([])
      const contributeSpy = vi
        .spyOn(goalService, 'contributeToGoal')
        .mockResolvedValue({
          ...mockGoalActive,
          current_amount: '25000.00',
          remaining_amount: '25000.00',
        })
      const onClose = vi.fn()

      renderWithProviders(
        <ContributeSheet
          isOpen={true}
          onClose={onClose}
          goal={mockGoalActive}
        />
      )

      const amountInput = screen.getByPlaceholderText(/e\.g\. 2000/i)

      fireEvent.change(amountInput, { target: { value: '5000' } })
      fireEvent.submit(amountInput.closest('form')!)

      await waitFor(() => {
        expect(contributeSpy).toHaveBeenCalledWith(mockGoalActive.id, {
          amount: '5000.00',
          note: null,
        })
      })
    })
  })

  describe('DashboardGoalsOverview', () => {
    it('renders empty overview card when no goals exist', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockEmptyOverview)

      renderWithProviders(<DashboardGoalsOverview />)

      await waitFor(() => {
        expect(screen.getByText(/No savings goals yet/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Create Goal/i })).toBeInTheDocument()
    })

    it('renders overview card when goals exist with progress metrics', async () => {
      vi.spyOn(goalService, 'getGoalsOverview').mockResolvedValue(mockOverview)

      renderWithProviders(<DashboardGoalsOverview />)

      await waitFor(() => {
        expect(screen.getByText('Savings Goals')).toBeInTheDocument()
      })

      expect(screen.getByText('View All')).toBeInTheDocument()
      expect(screen.getByText('New Laptop')).toBeInTheDocument()
      expect(screen.getAllByText(/44.9%/i).length).toBeGreaterThan(0)
    })
  })
})
