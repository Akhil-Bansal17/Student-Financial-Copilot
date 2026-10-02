import { useState, useMemo } from 'react'
import {
  ArrowUpRight,
  Calendar,
  CreditCard,
  Receipt,
  ShoppingBag,
  MinusCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/utils'
import type { ForecastEventResponse } from '@/types/forecast'

interface ForecastTimelineProps {
  timeline: ForecastEventResponse[]
  forecastDays: number
}

type TimelineFilter = 'ALL' | 'INCOME' | 'RECURRING' | 'DISCRETIONARY'

export function ForecastTimeline({ timeline, forecastDays }: ForecastTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('ALL')

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'INCOME') {
      return timeline.filter((e) => e.is_inflow)
    }
    if (activeFilter === 'RECURRING') {
      return timeline.filter((e) => e.is_known_commitment)
    }
    if (activeFilter === 'DISCRETIONARY') {
      return timeline.filter((e) => e.type === 'ESTIMATED_SPENDING')
    }
    return timeline
  }, [timeline, activeFilter])

  const getEventIcon = (type: string, isInflow: boolean) => {
    if (isInflow) {
      return <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    }
    if (type === 'RECURRING_SUBSCRIPTION') {
      return <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
    }
    if (type === 'RECURRING_BILL') {
      return <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    }
    if (type === 'ESTIMATED_SPENDING') {
      return <MinusCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
    }
    return <ShoppingBag className="h-4 w-4 text-rose-600 dark:text-rose-400" />
  }

  const getEventBadge = (type: string, isInflow: boolean) => {
    if (isInflow) {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          Income
        </span>
      )
    }
    if (type === 'RECURRING_SUBSCRIPTION') {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">
          Subscription
        </span>
      )
    }
    if (type === 'RECURRING_BILL') {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
          Bill
        </span>
      )
    }
    if (type === 'ESTIMATED_SPENDING') {
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300">
          Discretionary
        </span>
      )
    }
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300">
        Recurring
      </span>
    )
  }

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden" data-testid="forecast-timeline">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Projected Cash Flow Timeline
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological feed of {timeline.length} expected commitments & events over {forecastDays} days
            </p>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({timeline.length})
            </button>
            <button
              onClick={() => setActiveFilter('INCOME')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === 'INCOME'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Inflows
            </button>
            <button
              onClick={() => setActiveFilter('RECURRING')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === 'RECURRING'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Recurring
            </button>
            <button
              onClick={() => setActiveFilter('DISCRETIONARY')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                activeFilter === 'DISCRETIONARY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Discretionary
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <Calendar className="h-8 w-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">No projected events in this category</p>
            <p className="text-xs text-slate-400">Select another filter or horizon to inspect cash flow events.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[460px] overflow-y-auto">
            {filteredEvents.map((event) => {
              const amountNum = Number(event.amount)
              const balanceAfterNum = Number(event.projected_balance_after)
              const dateObj = new Date(event.date)
              const dateFormatted = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                weekday: 'short',
              })

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3.5 sm:px-5 hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition-colors gap-3"
                  data-testid="forecast-timeline-event"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                      {getEventIcon(event.type, event.is_inflow)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {event.name}
                        </span>
                        {getEventBadge(event.type, event.is_inflow)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-0.5">
                        <span>{dateFormatted}</span>
                        {event.category && (
                          <>
                            <span>•</span>
                            <span>{event.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-bold font-mono ${
                        event.is_inflow
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {event.is_inflow ? '+' : '-'}
                      {formatINR(amountNum)}
                    </div>
                    {balanceAfterNum !== 0 && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        Bal: {formatINR(balanceAfterNum, 0)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
