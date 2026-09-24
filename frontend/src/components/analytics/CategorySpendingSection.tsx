import { PieChart, AlertCircle, RefreshCw, ShoppingBag } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import type { CategorySpendingResponse } from '@/types/analytics'

interface CategorySpendingSectionProps {
  data?: CategorySpendingResponse
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: 'bg-rose-500',
  Transport: 'bg-amber-500',
  Education: 'bg-emerald-500',
  Shopping: 'bg-indigo-500',
  Bills: 'bg-blue-500',
  Entertainment: 'bg-purple-500',
  Health: 'bg-teal-500',
  'Hostel/Rent': 'bg-cyan-500',
  Other: 'bg-zinc-500',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-primary'
}

export function CategorySpendingSection({
  data,
  isLoading,
  isError,
  onRetry,
}: CategorySpendingSectionProps) {
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 text-destructive text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Unable to load category spending breakdown.</span>
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
  const totalExpenses = data?.total_expenses ?? '0.00'
  const hasExpenses = items.length > 0 && parseFloat(totalExpenses) > 0

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
          <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary shrink-0" />
            <span>Spending by Category</span>
          </CardTitle>
          {!isLoading && hasExpenses && (
            <span className="text-xs sm:text-sm font-bold text-foreground">
              Total: {formatINR(totalExpenses)}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        ) : !hasExpenses ? (
          <div className="py-8 text-center space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              No spending data for this month.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Horizontal progress stacked indicator */}
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
              {items.map((item) => {
                const pct = Math.max(0, parseFloat(item.percentage) || 0)
                if (pct <= 0) return null
                return (
                  <div
                    key={item.category}
                    style={{ width: `${pct}%` }}
                    className={`h-full ${getCategoryColor(item.category)} transition-all duration-300`}
                    title={`${item.category}: ${formatINR(item.amount)} (${item.percentage}%)`}
                  />
                )
              })}
            </div>

            {/* List breakdown */}
            <div className="space-y-2.5 pt-1">
              {items.map((item) => {
                const colorClass = getCategoryColor(item.category)
                const pct = Math.max(0, Math.min(100, parseFloat(item.percentage) || 0))
                return (
                  <div
                    key={item.category}
                    className="p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full ${colorClass} shrink-0`} />
                        <span className="font-semibold text-foreground truncate">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden xs:inline">
                          ({item.transaction_count}{' '}
                          {item.transaction_count === 1 ? 'txn' : 'txns'})
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-foreground">
                          {formatINR(item.amount)}
                        </span>
                        <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress track */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${colorClass}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
