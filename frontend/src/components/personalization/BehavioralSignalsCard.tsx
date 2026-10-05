import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  Store,
  PieChart,
  Calendar,
  ShieldAlert,
  Info,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  personalizationService,
  personalizationKeys,
} from '@/services/personalizationService'
import type { DataSufficiencyLevel } from '@/types'

function formatCurrency(amount: string | number): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0)
}

function getSufficiencyBadgeClass(level: DataSufficiencyLevel) {
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

export function BehavioralSignalsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: personalizationKeys.signals(),
    queryFn: () => personalizationService.getBehavioralSignals(),
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 p-5 space-y-4 bg-card" data-testid="behavioral-signals-loading">
        <Skeleton className="h-6 w-48 rounded-md" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </Card>
    )
  }

  if (isError || !data) {
    return null
  }

  const {
    data_sufficiency,
    transaction_count,
    analyzed_period_months,
    typical_transaction_amount,
    calculated_large_threshold,
    frequent_merchants,
    frequent_categories,
    spending_timing,
    signals_summary,
  } = data

  return (
    <Card className="rounded-2xl border border-border/80 p-5 space-y-6 bg-card" data-testid="behavioral-signals-card">
      {/* Title & Sufficiency Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Observed Behavioral Intelligence
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Deterministic spending patterns derived from verified transaction history.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge
            variant="outline"
            className={`text-xs px-2.5 py-1 font-semibold rounded-full uppercase ${getSufficiencyBadgeClass(
              data_sufficiency
            )}`}
          >
            {data_sufficiency} Evidence
          </Badge>
        </div>
      </div>

      {/* Summary Note */}
      <div className="rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
        <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Evidence Base: </span>
          {transaction_count} transaction(s) analyzed across the last {analyzed_period_months} month(s). {signals_summary}
        </div>
      </div>

      {/* Grid of Key Signal Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Metric 1: Typical & Large Baselines */}
        <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-card/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span>Transaction Baselines</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-xs text-muted-foreground block">Typical (Median)</span>
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(typical_transaction_amount)}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Large Spend Fence</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(calculated_large_threshold)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Transactions above the large spend fence are flagged as notable deviations in pace.
          </p>
        </div>

        {/* Metric 2: Spending Timing Observations */}
        <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-card/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-indigo-500" />
            <span>Timing Patterns</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span>Weekday: <strong className="text-foreground">{spending_timing.weekday_spend_percentage}%</strong></span>
            <span>Weekend: <strong className="text-foreground">{spending_timing.weekend_spend_percentage}%</strong></span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-2"
              style={{ width: `${Math.min(100, spending_timing.weekday_spend_percentage)}%` }}
              title="Weekday spend share"
            />
            <div
              className="bg-amber-500 h-2"
              style={{ width: `${Math.min(100, spending_timing.weekend_spend_percentage)}%` }}
              title="Weekend spend share"
            />
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            {spending_timing.timing_observation}
          </p>
        </div>
      </div>

      {/* Frequent Merchants & Frequent Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Frequent Merchants */}
        <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-card/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Store className="h-4 w-4 text-indigo-500" />
            <span>Frequent Merchants</span>
          </div>
          {frequent_merchants.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No recurrent merchant patterns detected yet.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {frequent_merchants.slice(0, 4).map((merch, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0"
                >
                  <div className="truncate max-w-[65%]">
                    <span className="font-semibold text-foreground">{merch.merchant_name}</span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">
                      ({merch.transaction_count}x)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-foreground block">
                      {formatCurrency(merch.total_spend)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {merch.frequency_share_pct}% of spend
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Frequent Categories */}
        <div className="rounded-xl border border-border/70 p-4 space-y-3 bg-card/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <PieChart className="h-4 w-4 text-indigo-500" />
            <span>Top Expense Categories</span>
          </div>
          {frequent_categories.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Insufficient expense transactions recorded.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {frequent_categories.slice(0, 4).map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0"
                >
                  <span className="font-semibold text-foreground truncate max-w-[60%]">
                    {cat.category}
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-foreground block">
                      {formatCurrency(cat.total_spend)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {cat.percentage}% of spend
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Safety & Grounding Footnote */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>
          Patterns are purely observational and never mutate your accounts, budgets, or savings goals.
        </span>
      </div>
    </Card>
  )
}
