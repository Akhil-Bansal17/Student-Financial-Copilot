export type GoalStatus = 'active' | 'completed' | 'overdue'

export interface GoalContribution {
  id: number
  goal_id: number
  user_id: number
  amount: string
  note: string | null
  created_at: string
}

export interface Goal {
  id: number
  user_id: number
  name: string
  description: string | null
  target_amount: string
  current_amount: string
  target_date: string | null
  created_at: string
  updated_at: string
  remaining_amount: string
  progress_percentage: string
  status: GoalStatus
  contributions: GoalContribution[]
}

export interface GoalsOverview {
  total_goals_count: number
  active_goals_count: number
  completed_goals_count: number
  overdue_goals_count: number
  total_target_amount: string
  total_saved_amount: string
  overall_progress_percentage: string
  goals: Goal[]
}

export interface CreateGoalRequest {
  name: string
  description?: string | null
  target_amount: string
  target_date?: string | null
}

export interface UpdateGoalRequest {
  name?: string
  description?: string | null
  target_amount?: string
  target_date?: string | null
}

export interface ContributeToGoalRequest {
  amount: string
  note?: string | null
}
