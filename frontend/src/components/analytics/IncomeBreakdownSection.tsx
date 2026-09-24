import { ArrowDownLeft, AlertCircle, RefreshCw, Wallet } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import type { IncomeCategoryResponse } from '@/types/analytics'

interface IncomeBreakdownSectionProps {
  data?: IncomeCategoryResponse
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

const INCOME_COLORS: Record<string, string> = {
  'Pocket Money': 'bg-emerald-500',
  Salary: 'bg-blue-500',
  Freelance: 'bg-indigo-500',
  Scholarship: 'bg-purple-500',
  'Family Support': 'bg-teal-500',
  Other: 'bg-zinc-500',
}

function getIncomeColor(category: string): string {
  return INCOME_COLORS[category] || 'bg-emerald-500'
}

export function IncomeBreakdownSection({
  data,
  isLoading,
  isError,
  onRetry,
}: IncomeBreakdownSectionProps) {
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 text-destructive text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Unable to load income breakdown.</span>
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

  const items = data?.items || []
  const totalIncome = data?.total_income ?? '0.00'
  const hasIncome = items.length > 0 && parseFloat(totalIncome) > 0

  return (
    <Card className="rounded-2xl border-border/70 bg-card/60 shadow-xs">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Income by Source</span>
          </CardTitle>
          {!isLoading && hasIncome && (
            <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Total: {formatINR(totalIncome)}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3">
        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ) : !hasIncome ? (
          <div className="py-6 text-center space-y-2">
            <div className="h-9 w-9 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Wallet className="h-4 w-4" />
            </div>
            <p className="text-xs text-muted-foreground">
              No income data for this month.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const colorClass = getIncomeColor(item.category)
              const pct = Math.max(0, Math.min(100, parseFloat(item.percentage) || 0))
              return (
                <div
                  key={item.category}
                  className="p-2 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full ${colorClass} shrink-0`} />
                      <span className="font-medium text-foreground truncate">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-foreground">
                        {formatINR(item.amount)}
                      </span>
                      <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${colorClass}`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
