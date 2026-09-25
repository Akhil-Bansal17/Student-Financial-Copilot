import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Wallet,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { budgetService, budgetKeys } from '@/services/budgetService'
import { BudgetFormSheet } from '@/components/budgets/BudgetFormSheet'
import { formatINR } from '@/lib/utils'

interface DashboardBudgetOverviewProps {
  year: number
  month: number
}

export function DashboardBudgetOverview({ year, month }: DashboardBudgetOverviewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: summary, isLoading, isError } = useQuery({
    queryKey: budgetKeys.summary(year, month),
    queryFn: () => budgetService.getBudgetSummary(year, month),
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

  if (isError || !summary) {
    return null
  }

  // Case 1: No budget set for this month at all
  if (!summary.has_any_budget) {
    return (
      <>
        <Card className="rounded-2xl border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  No budget set for this month
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set a monthly limit to prevent overspending and keep allowances on track.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsFormOpen(true)}
              className="rounded-xl gap-1.5 shadow-xs shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Set Budget</span>
            </Button>
          </div>
        </Card>

        <BudgetFormSheet
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          defaultYear={year}
          defaultMonth={month}
        />
      </>
    )
  }

  // Case 2: Either overall budget or category budgets are configured
  const hasOverall = summary.has_overall_budget && summary.overall_budget !== null
  const utilNum = parseFloat(
    hasOverall
      ? summary.overall_utilization || '0'
      : summary.category_budgets.length > 0
      ? summary.category_budgets[0].utilization
      : '0'
  )
  const progressPercent = Math.min(Math.max(utilNum, 0), 100)

  return (
    <>
      <Card className="rounded-2xl border-border/80 shadow-card bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Monthly Budget Overview</h3>
                <p className="text-[11px] text-muted-foreground">
                  {summary.total_categories_budgeted > 0
                    ? `${summary.total_categories_budgeted} category limit${
                        summary.total_categories_budgeted > 1 ? 's' : ''
                      } active`
                    : 'Overall cap active'}
                </p>
              </div>
            </div>

            <Link
              to="/budgets"
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group transition-colors"
            >
              <span>Manage Budgets</span>
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Key Metrics */}
          {hasOverall ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Budget</span>
                  <span className="font-semibold text-foreground truncate block">
                    {formatINR(summary.overall_budget || '0')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Spent</span>
                  <span className="font-semibold text-foreground truncate block">
                    {formatINR(summary.overall_spending)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">Remaining</span>
                  <span
                    className={`font-semibold truncate block ${
                      summary.overall_over_budget
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatINR(summary.overall_remaining || '0')}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overall Utilization</span>
                  <div className="flex items-center gap-1.5">
                    {summary.overall_over_budget && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Over Budget
                      </Badge>
                    )}
                    <span className="font-bold text-foreground">{summary.overall_utilization}%</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      summary.overall_over_budget
                        ? 'bg-rose-500'
                        : utilNum >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* If no overall budget, show compact category summaries preview */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Category Spending Caps</span>
                <span className="font-semibold text-foreground">
                  {summary.category_budgets.length} configured
                </span>
              </div>
              <div className="space-y-1.5">
                {summary.category_budgets.slice(0, 3).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40 text-xs"
                  >
                    <span className="font-medium text-foreground">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatINR(cat.spent)} / {formatINR(cat.budget)}
                      </span>
                      {cat.over_budget ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Over
                        </Badge>
                      ) : (
                        <span className="font-semibold text-foreground">{cat.utilization}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BudgetFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        defaultYear={year}
        defaultMonth={month}
      />
    </>
  )
}
