import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronRight,
  CreditCard,
  Receipt,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { recurringService, recurringKeys } from '@/services/recurringService'
import { formatINR } from '@/lib/utils'

export function DashboardRecurringPreview() {
  const { data: summary, isLoading, isError } = useQuery({
    queryKey: recurringKeys.summary(),
    queryFn: () => recurringService.getSummary(),
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/80 p-4 sm:p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </Card>
    )
  }

  if (isError || !summary) {
    return null
  }

  const totalMonthly = Number(summary.total_monthly_recurring_spend || 0)
  const nextPayment = summary.upcoming_payments?.[0]
  const nextDateFormatted = nextPayment
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(nextPayment.next_expected_date))
    : null

  // Empty state
  if (summary.total_detected_count === 0) {
    return (
      <Card className="rounded-2xl border-border/80 bg-gradient-to-r from-card via-card to-indigo-500/5 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                Subscriptions & Recurring Commitments
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically detect Netflix, Spotify, broadband & periodic campus bills.
              </p>
            </div>
          </div>
          <Link
            to="/recurring"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs shrink-0 self-start sm:self-auto"
          >
            <span>Scan Subscriptions</span>
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    )
  }

  // Active Recurring Detected Preview
  return (
    <Card className="rounded-2xl border-border/80 p-4 sm:p-5 bg-card hover:border-indigo-500/30 transition-all shadow-xs space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CalendarClock className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Recurring Commitments
              </h3>
              <Badge variant="outline" className="text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                {formatINR(totalMonthly)}/mo
              </Badge>
            </div>
          </div>
        </div>

        <Link
          to="/recurring"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 touch-target"
        >
          <span>Manage all ({summary.total_detected_count})</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* 3 Metric Mini Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        {/* Next Due Highlight */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3 w-3 text-indigo-500" />
              Next Due
            </span>
            {nextPayment && (
              <span className="font-semibold text-foreground">{nextDateFormatted}</span>
            )}
          </div>
          {nextPayment ? (
            <div className="flex items-baseline justify-between pt-0.5">
              <p className="font-bold text-foreground truncate max-w-[120px]">
                {nextPayment.merchant}
              </p>
              <p className="font-bold font-mono text-foreground">
                {formatINR(nextPayment.latest_amount)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic text-[11px]">No upcoming payments</p>
          )}
        </div>

        {/* Subscriptions */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1 font-medium">
              <CreditCard className="h-3 w-3 text-purple-500" />
              Subscriptions
            </span>
            <span className="font-semibold text-foreground">
              {summary.subscription_count} active
            </span>
          </div>
          <div className="pt-0.5 flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">Monthly total</span>
            <span className="font-bold font-mono text-foreground">
              {formatINR(summary.subscription_monthly_spend)}
            </span>
          </div>
        </div>

        {/* Recurring Bills */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1 font-medium">
              <Receipt className="h-3 w-3 text-blue-500" />
              Recurring Bills
            </span>
            <span className="font-semibold text-foreground">
              {summary.recurring_expense_count} active
            </span>
          </div>
          <div className="pt-0.5 flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">Monthly total</span>
            <span className="font-bold font-mono text-foreground">
              {formatINR(Number(summary.bill_monthly_spend) + Number(summary.other_monthly_spend))}
            </span>
          </div>
        </div>
      </div>

      {/* Needs Attention alert if any */}
      {(summary.needs_attention?.length || 0) > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>{summary.needs_attention.length}</strong> recurring payment
              {summary.needs_attention.length > 1 ? 's' : ''} require attention (overdue or price change).
            </span>
          </div>
          <Link
            to="/recurring"
            className="font-semibold hover:underline flex items-center gap-0.5 shrink-0 ml-2"
          >
            Review
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Card>
  )
}
