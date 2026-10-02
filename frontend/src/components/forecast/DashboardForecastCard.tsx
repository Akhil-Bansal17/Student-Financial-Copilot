import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatINR } from '@/lib/utils'
import { forecastService, forecastKeys } from '@/services/forecastService'

export function DashboardForecastCard() {
  const navigate = useNavigate()
  const { data: summary, isLoading, isError } = useQuery({
    queryKey: forecastKeys.summary(30),
    queryFn: () => forecastService.getSummary(30),
  })

  if (isLoading) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-9 w-44 rounded-md" />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </Card>
    )
  }

  if (isError || !summary) {
    return null
  }

  const projectedBal = Number(summary.projected_balance)
  const commitments = Number(summary.expected_recurring_expenses)
  const minProjected = Number(summary.minimum_projected_balance)

  return (
    <Card
      className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 sm:p-6 transition-all duration-300 hover:shadow-lg space-y-4"
      data-testid="dashboard-forecast-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Cash Flow Forecast
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              30-day projected outlook
            </span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="text-[10px] px-2 py-0.5 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
        >
          {summary.confidence} Confidence
        </Badge>
      </div>

      {/* Main Projected Metric */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-1">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">
            Estimated Balance (30 Days)
          </span>
          <div
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              summary.is_negative_projected
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatINR(projectedBal)}
          </div>
        </div>

        {summary.is_negative_projected && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5" />
            Deficit projected
          </span>
        )}
        {!summary.is_negative_projected && summary.is_low_balance_projected && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
            <ShieldAlert className="h-3.5 w-3.5" />
            Below safety buffer
          </span>
        )}
      </div>

      {/* Commitments & Low Point stats */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Expected Commitments
          </span>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            {formatINR(commitments)}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Potential Low Point
          </span>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            {formatINR(minProjected)}
          </div>
        </div>
      </div>

      {/* Link to Full Forecast */}
      <div className="pt-1">
        <button
          onClick={() => navigate('/forecast')}
          className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition-colors"
        >
          <span>View Full Cash Flow Timeline & Planning</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  )
}
