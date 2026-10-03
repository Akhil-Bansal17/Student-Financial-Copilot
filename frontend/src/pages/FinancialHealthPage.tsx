import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HealthDimensionCard } from '@/components/financialHealth/HealthDimensionCard'
import { SmartActionCard } from '@/components/financialHealth/SmartActionCard'
import { PositiveSignalCard } from '@/components/financialHealth/PositiveSignalCard'
import { BankFreshnessBanner } from '@/components/financialHealth/BankFreshnessBanner'
import { DataSufficiencyBanner } from '@/components/financialHealth/DataSufficiencyBanner'
import {
  financialHealthService,
  financialHealthKeys,
} from '@/services/financialHealthService'

export function FinancialHealthPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: financialHealthKeys.overview(),
    queryFn: () => financialHealthService.getFinancialHealth(),
    staleTime: 60 * 1000,
  })

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>

        <Card className="p-6 rounded-2xl border border-border/80 space-y-4">
          <Skeleton className="h-6 w-44 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // Error retry state
  if (isError || !data) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Financial Health
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            A snapshot of your current financial position based on your recent activity.
          </p>
        </div>

        <Card className="p-8 text-center rounded-2xl border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Unable to load financial health assessment
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              {error instanceof Error
                ? error.message
                : 'An unexpected error occurred while calculating your financial health. Please try again.'}
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="rounded-xl text-xs gap-1.5 font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </Button>
        </Card>
      </div>
    )
  }

  const {
    overview,
    dimensions,
    actions,
    positive_signals,
    bank_freshness,
    data_sufficiency,
  } = data

  const dimensionList = Object.values(dimensions)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Financial Health
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-2 font-semibold text-primary border-primary/30"
            >
              Deterministic
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            A snapshot of your current financial position based on your recent activity.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-xl text-xs font-medium gap-1.5 self-start sm:self-auto h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>{isFetching ? 'Recalculating...' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Honest Data Sufficiency Alert if baseline is limited */}
      <DataSufficiencyBanner
        sufficiency={data_sufficiency}
        summary={overview.overall_summary}
      />

      {/* Bank Data Freshness Alert if bank sync is connected */}
      <BankFreshnessBanner freshness={bank_freshness} />

      {/* Overview Snapshot Card (Deterministic, No arbitrary gamified score) */}
      <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Health Assessment Overview
                </h2>
                <Badge
                  variant="outline"
                  className="text-[11px] py-0.5 px-2 bg-primary/5 text-primary border-primary/30 font-semibold"
                >
                  {overview.overall_status_label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluated deterministically across 7 financial dimensions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="bg-muted/60 rounded-xl px-3 py-1.5 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                Attention
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {overview.total_actions_count}
              </span>
            </div>

            <div className="bg-muted/60 rounded-xl px-3 py-1.5 text-center">
              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider font-semibold">
                Positive Signals
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {overview.positive_signals_count}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed border-t border-border/60 pt-3">
          {overview.overall_summary}
        </p>
      </Card>

      {/* SMART ACTION CENTER */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>What Needs Attention</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                {actions.length}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Prioritized, evidence-backed actions derived from verified facts
            </p>
          </div>
        </div>

        {actions.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 p-6 text-center space-y-2">
            <div className="inline-flex p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              No Urgent Attention Needed
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              All monitored financial dimensions are currently within safe operational limits. Keep tracking your daily campus spending.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actions.map((action) => (
              <SmartActionCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </section>

      {/* FINANCIAL HEALTH DIMENSIONS GRID */}
      <section className="space-y-3.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            Financial Health Dimensions
          </h2>
          <p className="text-xs text-muted-foreground">
            Clear, transparent indicators traceable to authoritative financial records
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dimensionList.map((detail) => (
            <HealthDimensionCard key={detail.dimension} detail={detail} />
          ))}
        </div>
      </section>

      {/* POSITIVE SIGNALS SECTION */}
      {positive_signals.length > 0 && (
        <section className="space-y-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>What's Working Well</span>
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </h2>
            <p className="text-xs text-muted-foreground">
              Positive financial facts backed by verified data
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {positive_signals.map((signal) => (
              <PositiveSignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
