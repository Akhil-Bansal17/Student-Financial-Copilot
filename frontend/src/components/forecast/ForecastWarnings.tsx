import { AlertTriangle, AlertCircle, Info, Clock } from 'lucide-react'
import type { CashFlowForecastResponse } from '@/types/forecast'

interface ForecastWarningsProps {
  forecast: CashFlowForecastResponse
}

export function ForecastWarnings({ forecast }: ForecastWarningsProps) {
  const hasWarnings = forecast.warnings && forecast.warnings.length > 0
  const hasStaleBank = Boolean(
    forecast.bank_data_freshness && forecast.bank_data_freshness.includes('stale')
  )

  if (!hasWarnings && !hasStaleBank && !forecast.is_negative_projected && !forecast.is_low_balance_projected) {
    return null
  }

  return (
    <div className="space-y-3" data-testid="forecast-warnings">
      {/* Negative Projected Balance Critical Alert */}
      {forecast.is_negative_projected && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300"
        >
          <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-semibold">Projected Negative Balance Warning</h4>
            <p className="text-xs sm:text-sm leading-relaxed text-rose-600/90 dark:text-rose-300/90">
              Your estimated balance becomes negative around{' '}
              <span className="font-semibold underline">
                {forecast.negative_balance_date}
              </span>{' '}
              based on current recurring commitments and discretionary spending patterns. Consider postponing non-essential expenses.
            </p>
          </div>
        </div>
      )}

      {/* Low Balance Alert (Below Minimum Threshold) */}
      {!forecast.is_negative_projected && forecast.is_low_balance_projected && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300"
        >
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-semibold">Low Balance Threshold Alert</h4>
            <p className="text-xs sm:text-sm leading-relaxed text-amber-600/90 dark:text-amber-300/90">
              Your projected balance may fall below your minimum preferred threshold around{' '}
              <span className="font-semibold underline">
                {forecast.low_balance_date}
              </span>
              . Keep an eye on upcoming commitments.
            </p>
          </div>
        </div>
      )}

      {/* Insufficient / Limited Data Notice */}
      {forecast.data_sufficiency === 'INSUFFICIENT' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
          <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-semibold">Preliminary Forecast</h4>
            <p className="text-xs sm:text-sm leading-relaxed text-blue-600/90 dark:text-blue-300/90">
              Transaction history is limited. Projections are calculated from your verified starting balance and any active recurring expenses. Discretionary spending estimates will activate as you record more activity.
            </p>
          </div>
        </div>
      )}

      {/* Bank Synchronization Freshness Note */}
      {forecast.bank_data_freshness && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400">
          <Clock className="h-4 w-4 text-slate-500 shrink-0" />
          <span>{forecast.bank_data_freshness}</span>
        </div>
      )}
    </div>
  )
}
