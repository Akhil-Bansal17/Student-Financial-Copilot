import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  AlertTriangle,
  Target,
  RefreshCw,
  Wallet,
  PieChart,
  Layers,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { FinancialInsight, InsightType, InsightPriority } from '@/types/insight'

interface InsightCardProps {
  insight: FinancialInsight
  compact?: boolean
}

function renderInsightIcon(type: InsightType, priority: InsightPriority, className: string) {
  switch (type) {
    case 'cash_flow':
      return priority === 'positive' ? <TrendingUp className={className} /> : <ArrowDownLeft className={className} />
    case 'top_category':
      return <PieChart className={className} />
    case 'spending_trend':
      return priority === 'positive' ? <TrendingDown className={className} /> : <TrendingUp className={className} />
    case 'monthly_change':
      return <Calendar className={className} />
    case 'spending_concentration':
      return <Layers className={className} />
    case 'budget':
      return priority === 'warning' ? <AlertTriangle className={className} /> : <Wallet className={className} />
    case 'goal':
      return priority === 'positive' ? <CheckCircle2 className={className} /> : <Target className={className} />
    case 'recurring_pattern':
      return <RefreshCw className={className} />
    default:
      return <TrendingUp className={className} />
  }
}

function getPriorityConfig(priority: InsightPriority) {
  switch (priority) {
    case 'positive':
      return {
        badgeVariant: 'success' as const,
        badgeLabel: 'Positive',
        iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
        borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
      }
    case 'warning':
      return {
        badgeVariant: 'destructive' as const,
        badgeLabel: 'Warning',
        iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
        borderColor: 'border-rose-200/60 dark:border-rose-800/40',
      }
    case 'info':
    default:
      return {
        badgeVariant: 'secondary' as const,
        badgeLabel: 'Info',
        iconBg: 'bg-primary/10 text-primary',
        borderColor: 'border-border/80',
      }
  }
}

export function InsightCard({ insight, compact = false }: InsightCardProps) {
  const config = getPriorityConfig(insight.priority)

  const rawAmount = insight.amount ?? (insight as unknown as { value?: string }).value
  const numAmount = rawAmount ? parseFloat(String(rawAmount)) : null
  const rawPct = insight.percentage
  const numPct = rawPct !== null && rawPct !== undefined ? parseFloat(String(rawPct)) : null

  if (compact) {
    return (
      <Card className="rounded-2xl border-border/80 p-3.5 bg-card hover:border-primary/30 transition-all shadow-xs">
        <CardContent className="p-0 flex items-start space-x-3">
          <div className={`h-8 w-8 rounded-xl ${config.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
            {renderInsightIcon(insight.type, insight.priority, 'h-4 w-4')}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-1.5">
              <h4 className="text-xs font-bold text-foreground truncate">{insight.title}</h4>
              <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0 shrink-0">
                {config.badgeLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {insight.description}
            </p>
            {numAmount !== null && (
              <div className="pt-0.5 text-xs font-semibold text-foreground">
                {formatINR(numAmount)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs hover:shadow-card transition-all bg-card overflow-hidden flex flex-col justify-between">
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-3 min-w-0">
            <div className={`h-10 w-10 rounded-2xl ${config.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
              {renderInsightIcon(insight.type, insight.priority, 'h-5 w-5')}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug truncate" title={insight.title}>
                {insight.title}
              </h3>
              {insight.category && (
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground">
                  {insight.category}
                </span>
              )}
            </div>
          </div>

          <Badge variant={config.badgeVariant} className="text-[10px] font-semibold px-2 py-0.5 shrink-0">
            {config.badgeLabel}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>

        {/* Metrics Footer (Amount / Percentage / Period) */}
        {(numAmount !== null || numPct !== null) && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {numAmount !== null && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Value</span>
                  <span className="font-bold text-foreground">{formatINR(numAmount)}</span>
                </div>
              )}
              {numPct !== null && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">Impact</span>
                  <span className={`font-bold ${insight.priority === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : insight.priority === 'warning' ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                    {numPct > 0 ? `+${numPct}%` : `${numPct}%`}
                  </span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {insight.period}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
