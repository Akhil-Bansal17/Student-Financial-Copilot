import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Compass,
  ShieldCheck,
  TrendingDown,
  PieChart,
  Sparkles,
  PiggyBank,
  Eye,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  personalizationService,
  personalizationKeys,
} from '@/services/personalizationService'
import type { FinancialPriority, DataSufficiencyLevel } from '@/types'

function PriorityIcon({ priority, className }: { priority: FinancialPriority; className?: string }) {
  switch (priority) {
    case 'BUILD_BUFFER':
      return <ShieldCheck className={className} />
    case 'CONTROL_SPENDING':
      return <TrendingDown className={className} />
    case 'STAY_WITHIN_BUDGET':
      return <PieChart className={className} />
    case 'REACH_GOALS':
      return <Sparkles className={className} />
    case 'SAVE_MORE':
      return <PiggyBank className={className} />
    case 'UNDERSTAND_SPENDING':
      return <Eye className={className} />
    case 'BALANCED':
    default:
      return <Compass className={className} />
  }
}

function getPriorityLabel(priority: FinancialPriority): string {
  switch (priority) {
    case 'BUILD_BUFFER':
      return 'Build Cash Buffer'
    case 'CONTROL_SPENDING':
      return 'Control Spending'
    case 'STAY_WITHIN_BUDGET':
      return 'Stay Within Budget'
    case 'REACH_GOALS':
      return 'Reach Savings Goals'
    case 'SAVE_MORE':
      return 'Maximize Savings'
    case 'UNDERSTAND_SPENDING':
      return 'Understand Spending'
    case 'BALANCED':
    default:
      return 'Balanced Overview'
  }
}

function getSufficiencyBadgeVariant(level: DataSufficiencyLevel) {
  switch (level) {
    case 'STRONG':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'MODERATE':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    case 'LIMITED':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'INSUFFICIENT':
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function FinancialFocusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: personalizationKeys.effective(),
    queryFn: () => personalizationService.getEffectiveConfig(),
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 p-5 space-y-3 bg-card" data-testid="financial-focus-loading">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </Card>
    )
  }

  if (isError || !data || !data.is_personalization_enabled) {
    return null
  }

  const priorityLabel = getPriorityLabel(data.financial_priority)
  const topAction = data.top_recommended_action

  return (
    <Card
      className="rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 via-card to-card dark:from-indigo-950/20 dark:via-card dark:to-card p-4 sm:p-5 transition-all duration-200 hover:shadow-md space-y-4"
      data-testid="financial-focus-card"
    >
      {/* Header: Title + Adaptive Evidence Level */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <PriorityIcon priority={data.financial_priority} className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Your Financial Focus
            </span>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {priorityLabel}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getSufficiencyBadgeVariant(
              data.data_sufficiency
            )}`}
          >
            {data.data_sufficiency} EVIDENCE
          </Badge>
          <Link
            to="/personalization"
            aria-label="Customize Personalization Focus"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Sliders className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Focus Description */}
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {data.priority_focus_description}
      </p>

      {/* Top Personalized Recommendation */}
      {topAction && (
        <div className="rounded-xl border border-border/80 bg-background/80 p-3 sm:p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">
                Recommended Action for Your Focus
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase px-1.5 py-0.2 ${
                topAction.priority === 'CRITICAL'
                  ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                  : 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
              }`}
            >
              {topAction.priority}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            <strong className="text-foreground font-medium">{topAction.title}:</strong>{' '}
            {topAction.description}
          </p>
          {topAction.action_url && (
            <Link
              to={topAction.action_url}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5"
            >
              Take Action <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Footer link to Settings */}
      <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
        <span>Sensitivity: <strong className="text-foreground capitalize">{data.alert_sensitivity.toLowerCase()}</strong></span>
        <Link
          to="/personalization"
          className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          Manage Focus <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  )
}
