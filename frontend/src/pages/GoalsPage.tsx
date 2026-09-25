import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Target,
  Plus,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormSheet } from '@/components/goals/GoalFormSheet'
import { ContributeSheet } from '@/components/goals/ContributeSheet'
import { goalService, goalKeys } from '@/services/goalService'
import { queryClient } from '@/lib/queryClient'
import { formatINR } from '@/lib/utils'
import type { Goal } from '@/types/goal'

type StatusFilter = 'all' | 'active' | 'completed' | 'overdue'

export function GoalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Sheet states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const [isContributeOpen, setIsContributeOpen] = useState(false)
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch overview metrics
  const {
    data: overview,
    isLoading: isOverviewLoading,
  } = useQuery({
    queryKey: goalKeys.overview(),
    queryFn: () => goalService.getGoalsOverview(),
  })

  // Fetch filtered goals list
  const {
    data: goals,
    isLoading: isGoalsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: goalKeys.list(statusFilter === 'all' ? undefined : statusFilter),
    queryFn: () => goalService.getGoals(statusFilter === 'all' ? undefined : statusFilter),
  })

  const handleOpenCreate = () => {
    setEditingGoal(null)
    setIsFormOpen(true)
  }

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal)
    setIsFormOpen(true)
  }

  const handleContribute = (goal: Goal) => {
    setContributingGoal(goal)
    setIsContributeOpen(true)
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      setDeletingId(id)
      await goalService.deleteGoal(id)
      await queryClient.invalidateQueries({ queryKey: goalKeys.all })
    } finally {
      setDeletingId(null)
    }
  }

  const isLoading = isGoalsLoading || isOverviewLoading

  // Calculate percentage for overview
  const overallPercent = Math.min(
    100,
    Math.max(0, parseFloat(overview?.overall_progress_percentage || '0'))
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Savings Goals</span>
            <Target className="h-5 w-5 text-primary" />
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Targeted allowances for student aspirations, gadget upgrades, and emergency reserves
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="rounded-xl gap-1.5 shadow-xs w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Goal</span>
        </Button>
      </div>

      {/* 2. Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/80 p-5 space-y-4">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      )}

      {/* 3. Error State */}
      {isError && (
        <Card className="rounded-2xl border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-destructive">
              Failed to load savings goals
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Please check your connection and try again.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="rounded-xl gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </Card>
      )}

      {/* 4. Main Content */}
      {!isLoading && !isError && (
        <>
          {/* Summary Overview Card (if at least one goal exists) */}
          {overview && overview.total_goals_count > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-xs bg-gradient-to-r from-card via-card to-primary/5 overflow-hidden">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Total Savings Progress</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {overview.active_goals_count} active • {overview.completed_goals_count} completed
                        {overview.overdue_goals_count > 0 && ` • ${overview.overdue_goals_count} overdue`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 border-primary/30 text-primary">
                    {overview.overall_progress_percentage}% Overall
                  </Badge>
                </div>

                {/* 3-Column Metrics */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Total Saved</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                      {formatINR(overview.total_saved_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Total Target</span>
                    <span className="font-bold text-foreground truncate block">
                      {formatINR(overview.total_target_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Goals Reached</span>
                    <span className="font-bold text-foreground truncate block">
                      {overview.completed_goals_count} / {overview.total_goals_count}
                    </span>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter Tabs */}
          {overview && overview.total_goals_count > 0 && (
            <div className="flex items-center space-x-1 border-b border-border/60 pb-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] opacity-80">({overview.total_goals_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'active'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>Active</span>
                <span className="text-[10px] opacity-80">({overview.active_goals_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'completed'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Completed</span>
                <span className="text-[10px] opacity-80">({overview.completed_goals_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'overdue'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Overdue</span>
                <span className="text-[10px] opacity-80">({overview.overdue_goals_count})</span>
              </button>
            </div>
          )}

          {/* Goals Content */}
          {(!goals || goals.length === 0) ? (
            overview && overview.total_goals_count > 0 ? (
              /* Filtered empty state */
              <Card className="rounded-2xl border-dashed border-2 border-border/80 p-8 text-center bg-card/40">
                <div className="max-w-sm mx-auto space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <Archive className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      No {statusFilter} goals found
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      You do not have any savings goals matching this status filter.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatusFilter('all')}
                    className="rounded-xl gap-1.5 text-xs"
                  >
                    View All Goals
                  </Button>
                </div>
              </Card>
            ) : (
              /* Global empty state */
              <Card className="rounded-2xl border-dashed border-2 border-border/80 p-8 sm:p-12 text-center bg-card/40">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Target className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      No savings goals created yet
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                      Set a target for a semester laptop, festival travel, or textbook emergency reserve to build lasting student savings habits.
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenCreate}
                    className="rounded-xl gap-1.5 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Your First Goal</span>
                  </Button>
                </div>
              </Card>
            )
          ) : (
            /* Grid of Goals */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => handleEditGoal(goal)}
                  onDelete={handleDeleteGoal}
                  onContribute={() => handleContribute(goal)}
                  isDeleting={deletingId === goal.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Goal Form Sheet (Create / Edit) */}
      <GoalFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingGoal(null)
        }}
        initialGoal={editingGoal}
      />

      {/* Contribute Sheet (Add Money & History) */}
      <ContributeSheet
        isOpen={isContributeOpen}
        onClose={() => {
          setIsContributeOpen(false)
          setContributingGoal(null)
        }}
        goal={contributingGoal}
      />
    </div>
  )
}
