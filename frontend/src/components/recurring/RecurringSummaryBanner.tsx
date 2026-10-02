import {
  CalendarClock,
  RefreshCw,
  Receipt,
  CreditCard,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatINR } from '@/lib/utils'
import type { RecurringSummary } from '@/types/recurring'

interface RecurringSummaryBannerProps {
  summary?: RecurringSummary
  isLoading: boolean
  onDetect: () => void
  isDetecting: boolean
}

export function RecurringSummaryBanner({
  summary,
  isLoading,
  onDetect,
  isDetecting,
}: RecurringSummaryBannerProps) {
  const totalMonthly = Number(summary?.total_monthly_recurring_spend || 0)
  const subscriptionSpend = Number(summary?.subscription_monthly_spend || 0)
  const billSpend = Number(summary?.bill_monthly_spend || 0)
  const otherSpend = Number(summary?.other_monthly_spend || 0)
  const fixedSpend = Number(summary?.fixed_recurring_spend || 0)
  const variableSpend = Number(summary?.variable_recurring_spend || 0)

  const fixedPercentage =
    totalMonthly > 0 ? Math.round((fixedSpend / totalMonthly) * 100) : 0
  const variablePercentage =
    totalMonthly > 0 ? Math.round((variableSpend / totalMonthly) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Primary Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 sm:p-7 text-white shadow-elevation">
        {/* Glow blur backgrounds */}
        <div className="absolute -right-8 -bottom-8 h-44 w-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-20 top-2 h-24 w-24 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shrink-0">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-indigo-100/90 block">
                  Committed Monthly Spend
                </span>
                <span className="text-[11px] text-indigo-200/80">
                  Deterministic recurring obligations & subscriptions
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDetect}
                disabled={isDetecting || isLoading}
                className="h-8 text-xs font-semibold text-white border-white/25 hover:bg-white/15 bg-white/10 backdrop-blur-xs rounded-xl gap-1.5 shadow-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Scanning...' : 'Detect Recurring'}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            {isLoading ? (
              <div className="h-12 w-48 bg-white/20 animate-pulse rounded-xl" />
            ) : (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {formatINR(totalMonthly)}
                </span>
                <span className="text-xs sm:text-sm font-medium text-indigo-200/90">
                  / month committed
                </span>
              </div>
            )}
            <p className="text-xs text-indigo-100/80 flex items-center gap-1.5 pt-0.5">
              <Sparkles className="h-3 w-3 text-indigo-300" />
              <span>
                Based on {summary?.total_detected_count || 0} active recurring patterns across bank and manual entries
              </span>
            </p>
          </div>

          {/* Fixed vs Variable Progress Bar */}
          {totalMonthly > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/15">
              <div className="flex items-center justify-between text-xs text-indigo-100/90">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                  <span>Fixed: {formatINR(fixedSpend)} ({fixedPercentage}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-300 inline-block" />
                  <span>Variable: {formatINR(variableSpend)} ({variablePercentage}%)</span>
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-black/20 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${fixedPercentage}%` }}
                  title={`Fixed: ${fixedPercentage}%`}
                />
                <div
                  className="h-full bg-amber-300 transition-all duration-500"
                  style={{ width: `${variablePercentage}%` }}
                  title={`Variable: ${variablePercentage}%`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3 Metric Cards: Subscriptions, Bills, Needs Attention */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Subscriptions Card */}
        <Card className="rounded-2xl border-border/80 p-4 bg-card hover:border-indigo-500/30 transition-all shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-muted-foreground text-xs font-medium">
                <CreditCard className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Subscriptions</span>
              </div>
              <Badge variant="outline" className="text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                {summary?.subscription_count || 0} active
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {formatINR(subscriptionSpend)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground truncate">
              Spotify, Netflix, Prime, cloud storage
            </p>
          </div>
        </Card>

        {/* Recurring Bills Card */}
        <Card className="rounded-2xl border-border/80 p-4 bg-card hover:border-blue-500/30 transition-all shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-muted-foreground text-xs font-medium">
                <Receipt className="h-4 w-4 text-blue-500 shrink-0" />
                <span>Recurring Bills</span>
              </div>
              <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30">
                {summary?.recurring_expense_count || 0} active
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {formatINR(billSpend + otherSpend)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground truncate">
              Mobile recharges, broadband, utilities
            </p>
          </div>
        </Card>

        {/* Attention & Price Changes Card */}
        <Card className="rounded-2xl border-border/80 p-4 bg-card hover:border-amber-500/30 transition-all shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-muted-foreground text-xs font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Alerts & Changes</span>
              </div>
              {(summary?.needs_attention?.length || 0) > 0 ? (
                <Badge variant="destructive" className="text-[10px]">
                  {summary?.needs_attention.length} need review
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                  All clear
                </Badge>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {summary?.recently_changed?.length || 0}
                </p>
                <span className="text-xs text-muted-foreground">price changes tracked</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground truncate">
              Overdue renewals, plan price hikes & drops
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
