import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/utils'
import type { ForecastDailyPointResponse } from '@/types/forecast'

interface ForecastChartProps {
  dailyPoints: ForecastDailyPointResponse[]
  minimumThreshold: number | string
  forecastDays: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    payload: ForecastDailyPointResponse & { formattedDate: string }
  }>
  label?: string
}

function CustomForecastTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const pt = payload[0].payload
    const bal = Number(pt.projected_balance)
    const inflow = Number(pt.daily_inflow)
    const outflow = Number(pt.daily_outflow)

    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-xl backdrop-blur-md text-xs space-y-2 min-w-[200px]">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {pt.formattedDate}
          </span>
          {pt.is_actual && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              Today (Actual)
            </span>
          )}
          {!pt.is_actual && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              Projected
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Estimated Balance:</span>
            <span
              className={`font-mono font-bold ${
                bal < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : pt.is_below_minimum
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {formatINR(bal)}
            </span>
          </div>

          {inflow > 0 && (
            <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
              <span>Expected Inflow:</span>
              <span className="font-mono font-semibold">+{formatINR(inflow)}</span>
            </div>
          )}

          {outflow > 0 && (
            <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
              <span>Projected Outflow:</span>
              <span className="font-mono font-semibold">-{formatINR(outflow)}</span>
            </div>
          )}

          {pt.events_count > 0 && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
              {pt.events_count} scheduled event(s) on this date
            </div>
          )}

          {pt.is_negative && (
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 pt-1">
              ⚠️ Negative projected balance
            </div>
          )}
          {!pt.is_negative && pt.is_below_minimum && (
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 pt-1">
              🔔 Below minimum buffer
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

export function ForecastChart({
  dailyPoints,
  minimumThreshold,
  forecastDays,
}: ForecastChartProps) {
  const minThresholdNum = Number(minimumThreshold)

  // Format points for Recharts
  const chartData = dailyPoints.map((pt) => {
    const d = new Date(pt.date)
    const formattedDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return {
      ...pt,
      formattedDate,
      balanceNumeric: Number(pt.projected_balance),
    }
  })

  const hasNegative = chartData.some((pt) => pt.balanceNumeric < 0)

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Projected Cash Flow Curve
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological balance estimate across the next {forecastDays} days
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 inline-block" />
              <span>Projected Balance</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="h-0.5 w-3 border-t-2 border-dashed border-amber-500 inline-block" />
              <span>Safety Buffer ({formatINR(minThresholdNum, 0)})</span>
            </span>
            {hasNegative && (
              <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                <span className="h-0.5 w-3 border-t-2 border-dashed border-rose-500 inline-block" />
                <span>Zero Line (Deficit)</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-4">
        <div className="h-[280px] sm:h-[320px] w-full" data-testid="forecast-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#94a3b8"
                opacity={0.2}
              />

              <XAxis
                dataKey="formattedDate"
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={11}
                tickMargin={8}
                interval="preserveStartEnd"
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />

              <Tooltip content={<CustomForecastTooltip />} />

              {/* Minimum Buffer Threshold Line */}
              <ReferenceLine
                y={minThresholdNum}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />

              {/* Zero Deficit Line if dips negative */}
              {hasNegative && (
                <ReferenceLine
                  y={0}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}

              <Area
                type="monotone"
                dataKey="balanceNumeric"
                name="Projected Balance"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#forecastBalanceGrad)"
                activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
