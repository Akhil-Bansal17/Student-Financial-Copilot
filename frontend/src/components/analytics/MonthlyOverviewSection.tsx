import { TrendingUp, CreditCard, ArrowRightLeft, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import type { MonthlyAnalyticsResponse } from '@/types/analytics'

interface MonthlyOverviewSectionProps {
  data?: MonthlyAnalyticsResponse
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

function renderDeltaBadge(
  changePct: string | null | undefined
) {
  if (changePct === null || changePct === undefined) {
    return (
      <span className="text-[10px] text-muted-foreground font-medium">
        No previous-month data
      </span>
    )
  }

  const num = parseFloat(changePct)
  if (isNaN(num)) {
    return (
      <span className="text-[10px] text-muted-foreground font-medium">
        No previous-month data
      </span>
    )
  }

  if (num === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
        0.0% vs last month
      </span>
    )
  }

  const isPositive = num > 0
  const formatted = `${isPositive ? '+' : ''}${num.toFixed(1)}%`
  const label = isPositive ? 'Increased' : 'Decreased'

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
        isPositive
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      }`}
      title={`${label} by ${Math.abs(num)}% compared to previous month`}
    >
      {formatted} vs last month
    </span>
  )
}

export function MonthlyOverviewSection({
  data,
  isLoading,
  isError,
  onRetry,
}: MonthlyOverviewSectionProps) {
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 text-destructive text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Unable to load monthly overview.</span>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs h-8 rounded-xl font-medium gap-1.5 w-fit"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const monthlyIncome = data?.monthly_income ?? '0.00'
  const monthlyExpenses = data?.monthly_expenses ?? '0.00'
  const monthlyNet = data?.monthly_net_cash_flow ?? '0.00'

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-muted-foreground">
          Selected Month Activity
        </h2>
        {data && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {data.transaction_count} {data.transaction_count === 1 ? 'transaction' : 'transactions'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Monthly Income */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-emerald-500/30 transition-all">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Monthly Income</span>
              <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded-lg" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatINR(monthlyIncome)}
              </p>
            )}

            <div className="pt-0.5">
              {isLoading ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                renderDeltaBadge(data?.income_change_percentage)
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Monthly Expenses */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-rose-500/30 transition-all">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Monthly Expenses</span>
              <div className="h-6 w-6 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded-lg" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {formatINR(monthlyExpenses)}
              </p>
            )}

            <div className="pt-0.5">
              {isLoading ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                renderDeltaBadge(data?.expense_change_percentage)
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Monthly Net Cash Flow */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-primary/30 transition-all">
          <CardContent className="p-0 space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Net Cash Flow</span>
              <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-7 w-28 rounded-lg" />
            ) : (
              <p
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  parseFloat(monthlyNet) > 0
                    ? 'text-foreground'
                    : parseFloat(monthlyNet) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                }`}
              >
                {formatINR(monthlyNet)}
              </p>
            )}

            <div className="pt-0.5">
              {isLoading ? (
                <Skeleton className="h-4 w-24 rounded" />
              ) : (
                <span className="text-[10px] text-muted-foreground font-medium">
                  Income − Expenses for month
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
