import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  CalendarClock,
  ShieldCheck,
  SlidersHorizontal,
  MinusCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import type { CashFlowForecastResponse } from '@/types/forecast'

interface ForecastSummaryCardsProps {
  forecast: CashFlowForecastResponse
  onOpenPreference: () => void
}

export function ForecastSummaryCards({
  forecast,
  onOpenPreference,
}: ForecastSummaryCardsProps) {
  const projectedBal = Number(forecast.projected_balance)
  const startingBal = Number(forecast.starting_balance)
  const bankBal =
    forecast.current_connected_bank_balance !== null &&
    forecast.current_connected_bank_balance !== undefined
      ? Number(forecast.current_connected_bank_balance)
      : null
  const expectedIncome = Number(forecast.expected_income)
  const recurringSpend = Number(forecast.expected_recurring_expenses)
  const discretionarySpend = Number(forecast.estimated_discretionary_spending)
  const netCashFlow = Number(forecast.net_cash_flow)
  const minProjected = Number(forecast.minimum_projected_balance)
  const threshold = Number(forecast.minimum_balance_threshold)

  const isNetPositive = netCashFlow >= 0

  return (
    <div className="space-y-4" data-testid="forecast-summary-cards">
      {/* Hero Projected Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 sm:p-7 text-white shadow-elevation">
        {/* Decorative blur elements */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-24 top-2 h-24 w-24 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shrink-0">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-indigo-100/90 block">
                  {forecast.forecast_days}-Day Cash Flow Outlook
                </span>
                <span className="text-[11px] text-indigo-200/80">
                  Deterministic estimate based on verified recurring & historical spending
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-white/10 text-white border-white/20 text-xs px-2.5 py-0.5"
              >
                Data: {forecast.data_sufficiency}
              </Badge>
              <Badge
                variant="outline"
                className="bg-white/10 text-white border-white/20 text-xs px-2.5 py-0.5"
              >
                Confidence: {forecast.confidence}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenPreference}
                className="bg-white/15 hover:bg-white/25 text-white border-white/30 text-xs h-7 px-2.5 gap-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Buffer: {formatINR(threshold, 0)}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-1">
            {/* Projected Balance Metric */}
            <div className="space-y-1">
              <div className="text-xs text-indigo-200/90 uppercase tracking-wider font-medium">
                Estimated Balance (in {forecast.forecast_days} days)
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {formatINR(projectedBal)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-100/90 pt-0.5">
                {isNetPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-300" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-300" />
                )}
                <span>
                  Net projected shift:{' '}
                  <strong className={isNetPositive ? 'text-emerald-300' : 'text-rose-300'}>
                    {isNetPositive ? '+' : ''}
                    {formatINR(netCashFlow)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Current Starting Balances */}
            <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-white/15 sm:pl-5 pt-3 sm:pt-0">
              <div className="text-xs text-indigo-200/90 uppercase tracking-wider font-medium">
                Current Starting Position
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-indigo-100/80">
                    <Wallet className="h-3.5 w-3.5 text-indigo-300" />
                    Ledger Balance:
                  </span>
                  <span className="font-semibold text-white">{formatINR(startingBal)}</span>
                </div>
                {bankBal !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-indigo-100/80">
                      <Building2 className="h-3.5 w-3.5 text-emerald-300" />
                      Connected Bank:
                    </span>
                    <span className="font-semibold text-emerald-200">{formatINR(bankBal)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Potential Low Point */}
            <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-white/15 sm:pl-5 pt-3 sm:pt-0">
              <div className="text-xs text-indigo-200/90 uppercase tracking-wider font-medium">
                Estimated Lowest Point
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight">
                {formatINR(minProjected)}
              </div>
              <div className="text-xs text-indigo-200/80">
                {forecast.minimum_balance_date ? (
                  <>Estimated around {forecast.minimum_balance_date}</>
                ) : (
                  <>Stable throughout horizon</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Secondary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Expected Inflow */}
        <Card className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Expected Inflow
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(expectedIncome)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Predictable stipends, salary & allowance
          </p>
        </Card>

        {/* Known Recurring Commitments */}
        <Card className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Known Commitments
            </span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(recurringSpend)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Verified subscriptions, bills & rent
          </p>
        </Card>

        {/* Estimated Discretionary Spending */}
        <Card className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Discretionary Baseline
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <MinusCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(discretionarySpend)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Historical day-to-day spending pace
          </p>
        </Card>

        {/* Minimum Preferred Buffer */}
        <Card className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Preferred Buffer
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {formatINR(threshold)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Configured safety reserve threshold
          </p>
        </Card>
      </div>
    </div>
  )
}
