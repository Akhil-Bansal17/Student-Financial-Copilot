import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Target,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ForecastWarnings } from '@/components/forecast/ForecastWarnings'
import { ForecastSummaryCards } from '@/components/forecast/ForecastSummaryCards'
import { ForecastChart } from '@/components/forecast/ForecastChart'
import { ForecastTimeline } from '@/components/forecast/ForecastTimeline'
import { ForecastGoalPlanningCard } from '@/components/forecast/ForecastGoalPlanningCard'
import { ForecastBudgetPressureCard } from '@/components/forecast/ForecastBudgetPressureCard'
import { ForecastPreferenceModal } from '@/components/forecast/ForecastPreferenceModal'
import { ForecastEmptyState } from '@/components/forecast/ForecastEmptyState'
import { forecastService, forecastKeys } from '@/services/forecastService'
import type { ForecastHorizon } from '@/types/forecast'

export function ForecastPage() {
  const [horizon, setHorizon] = useState<ForecastHorizon>(30)
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false)
  const [planningTab, setPlanningTab] = useState<'TIMELINE' | 'PLANNING'>('TIMELINE')

  const {
    data: forecast,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: forecastKeys.forecast(horizon),
    queryFn: () => forecastService.getForecast(horizon),
  })

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-3 sm:px-6" data-testid="forecast-page">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Cash Flow Forecast
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Deterministic cash flow estimates based on verified recurring obligations & spending pace
          </p>
        </div>

        {/* Horizon switcher & actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setHorizon(7)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                horizon === 7
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setHorizon(30)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                horizon === 30
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setHorizon(90)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                horizon === 90
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              90 Days
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrefModalOpen(true)}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preferences</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-xl text-xs h-9 w-9 p-0 border-slate-200 dark:border-slate-700"
            title="Refresh forecast"
            aria-label="Refresh forecast"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="space-y-5" data-testid="forecast-loading">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div
          role="alert"
          className="p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5 text-center space-y-3"
          data-testid="forecast-error"
        >
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Unable to load cash flow forecast
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            A temporary error occurred while calculating your financial projections. Please try refreshing.
          </p>
          <Button
            onClick={() => refetch()}
            className="rounded-xl text-xs h-9 px-4 bg-indigo-600 text-white"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Content State */}
      {!isLoading && !isError && forecast && (
        forecast.data_sufficiency === 'INSUFFICIENT' &&
        Number(forecast.starting_balance) === 0 &&
        Number(forecast.expected_recurring_expenses) === 0 &&
        (!forecast.timeline || forecast.timeline.length === 0) ? (
          <ForecastEmptyState />
        ) : (
          <>
            {/* Warnings & Alerts */}
            <ForecastWarnings forecast={forecast} />

          {/* Primary Summary Cards */}
          <ForecastSummaryCards
            forecast={forecast}
            onOpenPreference={() => setIsPrefModalOpen(true)}
          />

          {/* Forecast Chart */}
          {forecast.daily_points && forecast.daily_points.length > 0 && (
            <ForecastChart
              dailyPoints={forecast.daily_points}
              minimumThreshold={forecast.minimum_balance_threshold}
              forecastDays={forecast.forecast_days}
            />
          )}

          {/* Planning & Timeline Section Tabs */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setPlanningTab('TIMELINE')}
                className={`flex items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-all ${
                  planningTab === 'TIMELINE'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Cash Flow Timeline</span>
              </button>

              <button
                onClick={() => setPlanningTab('PLANNING')}
                className={`flex items-center gap-2 pb-1 text-sm font-bold border-b-2 transition-all ${
                  planningTab === 'PLANNING'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Target className="h-4 w-4" />
                <span>Goals & Budget Feasibility</span>
              </button>
            </div>

            {planningTab === 'TIMELINE' && (
              <ForecastTimeline
                timeline={forecast.timeline || []}
                forecastDays={forecast.forecast_days}
              />
            )}

            {planningTab === 'PLANNING' && (
              <div className="space-y-5">
                <ForecastGoalPlanningCard goals={forecast.goal_planning || []} />
                <ForecastBudgetPressureCard budgets={forecast.budget_pressure || []} />
              </div>
            )}
          </div>

          {/* Preference Modal */}
          <ForecastPreferenceModal
            isOpen={isPrefModalOpen}
            onClose={() => setIsPrefModalOpen(false)}
            currentThreshold={forecast.minimum_balance_threshold}
          />
        </>
        )
      )}
    </div>
  )
}

export default ForecastPage
