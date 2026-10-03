import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  financialHealthService,
  financialHealthKeys,
} from '@/services/financialHealthService'

export function DashboardFinancialHealthCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: financialHealthKeys.overview(),
    queryFn: () => financialHealthService.getFinancialHealth(),
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 p-5 space-y-3 bg-card">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </Card>
    )
  }

  if (isError || !data) {
    return null
  }

  const { overview, actions, positive_signals } = data
  const topAction = actions.length > 0 ? actions[0] : null
  const hasCritical = overview.critical_actions_count > 0
  const hasHigh = overview.high_actions_count > 0

  return (
    <Card
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md space-y-4 ${
        hasCritical
          ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
          : hasHigh
          ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/15 dark:bg-amber-950/10'
          : 'border-border/80 bg-card'
      }`}
      data-testid="dashboard-financial-health-card"
    >
      {/* Header: Title + Overall Status Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              hasCritical
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : hasHigh
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-primary/10 text-primary'
            }`}
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Financial Health Assessment
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Evidence-backed situation & priorities
            </p>
          </div>
        </div>

        <Badge
          variant={hasCritical ? 'destructive' : hasHigh ? 'outline' : 'secondary'}
          className={`text-[11px] py-0.5 px-2.5 font-medium ${
            hasCritical
              ? 'bg-rose-600 text-white'
              : hasHigh
              ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
              : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
          }`}
        >
          {hasCritical ? (
            <AlertOctagon className="h-3 w-3 mr-1" />
          ) : hasHigh ? (
            <AlertTriangle className="h-3 w-3 mr-1" />
          ) : (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          )}
          <span>{overview.overall_status_label}</span>
        </Badge>
      </div>

      {/* Summary Text */}
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {overview.overall_summary}
      </p>

      {/* Top Action Highlight (if present) */}
      {topAction && (
        <div className="p-3 rounded-xl bg-background/80 border border-border/70 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <span>Primary Attention</span>
            </span>
            <Badge
              variant={topAction.priority === 'CRITICAL' ? 'destructive' : 'outline'}
              className="text-[10px] py-0 px-1.5"
            >
              {topAction.priority}
            </Badge>
          </div>
          <p className="text-xs font-semibold text-foreground">
            {topAction.title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {topAction.recommended_next_step}
          </p>
        </div>
      )}

      {/* Positive Highlight if no critical actions */}
      {!topAction && positive_signals.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{positive_signals[0].title}: {positive_signals[0].description}</span>
        </div>
      )}

      {/* Action Footer Link */}
      <div className="pt-1 flex items-center justify-between border-t border-border/50">
        <span className="text-[11px] text-muted-foreground">
          {actions.length} action{actions.length !== 1 ? 's' : ''} available
        </span>

        <Link
          to="/financial-health"
          className="inline-flex items-center justify-center h-8 text-xs font-semibold text-primary hover:text-primary/80 gap-1 px-2 hover:bg-muted/50 rounded-xl transition-colors"
        >
          <span>View Full Assessment</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}
