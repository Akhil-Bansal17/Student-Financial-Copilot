import {
  ShieldCheck,
  TrendingUp,
  PieChart,
  CalendarClock,
  Target,
  Layers,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { HealthDimensionDetail } from '@/types/financialHealth'

interface HealthDimensionCardProps {
  detail: HealthDimensionDetail
}

function getDimensionIcon(dimension: string, className: string) {
  switch (dimension) {
    case 'CASH_BUFFER':
      return <ShieldCheck className={className} />
    case 'CASH_FLOW_STABILITY':
      return <TrendingUp className={className} />
    case 'BUDGET_HEALTH':
      return <PieChart className={className} />
    case 'RECURRING_BURDEN':
      return <CalendarClock className={className} />
    case 'GOAL_HEALTH':
      return <Target className={className} />
    case 'SPENDING_PATTERN':
      return <Layers className={className} />
    case 'FORECAST_RISK':
      return <AlertTriangle className={className} />
    default:
      return <HelpCircle className={className} />
  }
}

function getStatusBadgeStyle(status: string, isAttentionRequired: boolean, isPositive: boolean) {
  if (status.includes('INSUFFICIENT') || status.includes('NO_ACTIVE')) {
    return {
      variant: 'secondary' as const,
      className: 'bg-muted text-muted-foreground border-border text-[11px] font-medium',
      icon: <HelpCircle className="h-3 w-3 mr-1" />,
    }
  }

  if (isAttentionRequired || status.includes('AT_RISK') || status.includes('OVER_BUDGET') || status.includes('CRITICAL') || status.includes('HIGH_RISK') || status.includes('NEGATIVE_TREND')) {
    return {
      variant: 'destructive' as const,
      className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-semibold',
      icon: <AlertOctagon className="h-3 w-3 mr-1" />,
    }
  }

  if (status.includes('APPROACHING') || status.includes('MODERATE') || status.includes('LIMITED') || status.includes('LOW_BUFFER') || status.includes('CONCENTRATED') || status.includes('NEEDS_ATTENTION')) {
    return {
      variant: 'outline' as const,
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-medium',
      icon: <AlertTriangle className="h-3 w-3 mr-1" />,
    }
  }

  if (isPositive || status.includes('HEALTHY') || status.includes('ON_TRACK') || status.includes('STABLE') || status.includes('COMPLETED') || status.includes('BALANCED') || status.includes('LOW_RISK') || status.includes('LOW')) {
    return {
      variant: 'outline' as const,
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium',
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
    }
  }

  return {
    variant: 'secondary' as const,
    className: 'text-[11px]',
    icon: null,
  }
}

export function HealthDimensionCard({ detail }: HealthDimensionCardProps) {
  const badgeStyle = getStatusBadgeStyle(
    detail.status,
    detail.is_attention_required,
    detail.is_positive
  )

  const supporting = detail.supporting_data || {}

  return (
    <Card
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
        detail.is_attention_required
          ? 'border-rose-200/70 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10'
          : detail.is_positive
          ? 'border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-950/5'
          : 'border-border/80 bg-card'
      }`}
      data-testid={`dimension-card-${detail.dimension}`}
    >
      <div className="space-y-3">
        {/* Header: Icon + Title + Status Badge */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                detail.is_attention_required
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : detail.is_positive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {getDimensionIcon(detail.dimension, 'h-4.5 w-4.5')}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {detail.name}
              </h3>
            </div>
          </div>

          <Badge
            variant={badgeStyle.variant}
            className={`py-0.5 px-2 flex items-center shrink-0 ${badgeStyle.className}`}
          >
            {badgeStyle.icon}
            <span>{detail.label}</span>
          </Badge>
        </div>

        {/* Fact-based deterministic summary */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {detail.summary}
        </p>
      </div>

      {/* Supporting Metrics Section (if present) */}
      {Object.keys(supporting).length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-2 text-[11px]">
          {supporting.current_ledger_balance && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Ledger: </span>
              <strong className="text-foreground font-mono">
                {formatINR(supporting.current_ledger_balance)}
              </strong>
            </div>
          )}

          {supporting.minimum_projected_balance && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Projected Low: </span>
              <strong className="text-foreground font-mono">
                {formatINR(supporting.minimum_projected_balance)}
              </strong>
            </div>
          )}

          {supporting.monthly_committed && Number(supporting.monthly_committed) > 0 && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Committed: </span>
              <strong className="text-foreground font-mono">
                {formatINR(supporting.monthly_committed)}/mo
              </strong>
            </div>
          )}

          {supporting.overall_utilization_pct && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Budget Used: </span>
              <strong className="text-foreground">
                {supporting.overall_utilization_pct}%
              </strong>
            </div>
          )}

          {supporting.total_target_amount && Number(supporting.total_target_amount) > 0 && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Target: </span>
              <strong className="text-foreground font-mono">
                {formatINR(supporting.total_target_amount)}
              </strong>
            </div>
          )}

          {supporting.top_category && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Top Category: </span>
              <strong className="text-foreground">
                {supporting.top_category}
              </strong>
            </div>
          )}

          {supporting.minimum_balance_date && (
            <div className="bg-muted/50 rounded-lg px-2 py-1 text-muted-foreground">
              <span>Low Date: </span>
              <span className="text-foreground">{supporting.minimum_balance_date}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
