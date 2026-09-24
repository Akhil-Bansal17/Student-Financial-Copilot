import { LineChart as ChartIcon, AlertCircle, RefreshCw, CalendarDays } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/utils'
import type { DailyTrendResponse } from '@/types/analytics'

interface SpendingTrendSectionProps {
  data?: DailyTrendResponse
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/80 bg-background/95 p-2.5 shadow-lg backdrop-blur-xs text-xs space-y-1">
        <p className="font-semibold text-foreground pb-1 border-b border-border/40">{label}</p>
        <div className="space-y-0.5 pt-0.5">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatINR(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function SpendingTrendSection({
  data,
  isLoading,
  isError,
  onRetry,
}: SpendingTrendSectionProps) {
  if (isError) {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 text-destructive text-sm font-medium">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Unable to load daily spending trend.</span>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs h-8 rounded-xl font-medium gap-1.5 w-fit"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const days = data?.days || []
  const hasTransactions = days.some(
    (d) => parseFloat(d.income) > 0 || parseFloat(d.expenses) > 0
  )

  const chartData = days.map((d) => {
    const inc = Math.max(0, parseFloat(d.income) || 0)
    const exp = Math.max(0, parseFloat(d.expenses) || 0)
    return {
      date: d.date,
      Income: inc,
      Expenses: exp,
    }
  })

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
          <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <ChartIcon className="h-4 w-4 text-primary shrink-0" />
            <span>Daily Cash Flow Trend</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground font-medium">
            Daily income vs expenses
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
        {isLoading ? (
          <div className="h-[240px] flex items-center justify-center p-4">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : !hasTransactions ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-center p-4 space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              No transaction activity recorded for this month.
            </p>
          </div>
        ) : (
          <div className="w-full h-[240px] sm:h-[260px] pt-2">
            <ResponsiveContainer width="100%" height={240} minWidth={100} minHeight={150} initialDimension={{ width: 400, height: 240 }}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val: string) => {
                    const parts = val.split('-')
                    return parts[2] ? parseInt(parts[2], 10).toString() : val
                  }}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(150, 150, 150, 0.2)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(val: number) => {
                    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`
                    return `₹${val}`
                  }}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="Income"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
                <Bar
                  dataKey="Expenses"
                  fill="#f43f5e"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
