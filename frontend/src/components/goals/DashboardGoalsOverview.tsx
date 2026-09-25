import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Target,
  ChevronRight,
  Plus,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { goalService, goalKeys } from '@/services/goalService'
import { GoalFormSheet } from '@/components/goals/GoalFormSheet'
import { formatINR } from '@/lib/utils'

export function DashboardGoalsOverview() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: overview, isLoading, isError } = useQuery({
    queryKey: goalKeys.overview(),
    queryFn: () => goalService.getGoalsOverview(),
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/80 p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </Card>
    )
  }

  if (isError || !overview) {
    return null
  }

  // Case 1: No goals created yet
  if (overview.total_goals_count === 0) {
    return (
      <>
        <Card className="rounded-2xl border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  No savings goals yet
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track student aspirations, textbook reserves, or vacation funds.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsFormOpen(true)}
              className="rounded-xl gap-1.5 shadow-xs shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create Goal</span>
            </Button>
          </div>
        </Card>

        <GoalFormSheet
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
        />
      </>
    )
  }

  // Case 2: User has goals
  const overallPercent = Math.min(
    100,
    Math.max(0, parseFloat(overview.overall_progress_percentage || '0'))
  )
  const isAllCompleted = overview.completed_goals_count === overview.total_goals_count

  // Filter top active goals to show (up to 2)
  const activeGoals = overview.goals.filter((g) => g.status === 'active' || g.status === 'overdue')
  const displayGoals = activeGoals.length > 0 ? activeGoals.slice(0, 2) : overview.goals.slice(0, 2)

  return (
    <>
      <Card className="rounded-2xl border-border/80 shadow-card bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Savings Goals</h3>
                <p className="text-[11px] text-muted-foreground">
                  {overview.active_goals_count > 0
                    ? `${overview.active_goals_count} active goal${
                        overview.active_goals_count === 1 ? '' : 's'
                      }`
                    : 'All goals completed'}
                  {overview.completed_goals_count > 0 &&
                    ` • ${overview.completed_goals_count} completed`}
                </p>
              </div>
            </div>

            <Link
              to="/goals"
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Saved</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                  {formatINR(overview.total_saved_amount)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Target</span>
                <span className="font-semibold text-foreground truncate block">
                  {formatINR(overview.total_target_amount)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block uppercase font-medium">Progress</span>
                <span className="font-semibold text-foreground truncate block">
                  {overview.overall_progress_percentage}%
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Overall Goal Progress</span>
                <div className="flex items-center gap-1.5">
                  {isAllCompleted && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">
                      All Reached
                    </Badge>
                  )}
                  <span className="font-bold text-foreground">
                    {overview.overall_progress_percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isAllCompleted ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>

            {/* Compact list of top goals */}
            {displayGoals.length > 0 && (
              <div className="pt-1 space-y-2">
                {displayGoals.map((goal) => {
                  const goalPercent = Math.min(
                    100,
                    Math.max(0, parseFloat(goal.progress_percentage || '0'))
                  )
                  return (
                    <div
                      key={goal.id}
                      className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate max-w-[180px]">
                          {goal.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {goal.status === 'completed' ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Done
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {goal.progress_percentage}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            goal.status === 'completed'
                              ? 'bg-emerald-500'
                              : goal.status === 'overdue'
                              ? 'bg-rose-500'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${goalPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {formatINR(goal.current_amount)} / {formatINR(goal.target_amount)}
                        </span>
                        {goal.target_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {goal.target_date}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GoalFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />
    </>
  )
}
