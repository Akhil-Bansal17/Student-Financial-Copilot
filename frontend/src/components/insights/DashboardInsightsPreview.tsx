import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, ChevronRight, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { insightService, insightKeys } from '@/services/insightService'
import { InsightCard } from '@/components/insights/InsightCard'

interface DashboardInsightsPreviewProps {
  year: number
  month: number
}

export function DashboardInsightsPreview({ year, month }: DashboardInsightsPreviewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: insightKeys.period(year, month),
    queryFn: () => insightService.getInsights(year, month),
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/80 p-4 sm:p-5 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </Card>
    )
  }

  if (isError || !data) {
    return null
  }

  const { insights, has_sufficient_data } = data

  // Case 1: Insufficient data or 0 insights
  if (!has_sufficient_data || insights.length === 0) {
    return (
      <Card className="rounded-2xl border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-4 sm:p-5 shadow-xs">
        <div className="flex items-start space-x-3.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              No financial insights yet
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              More transaction history needed to uncover spending patterns.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // Sort insights: warnings first, then positive, then info
  const priorityOrder = { warning: 0, positive: 1, info: 2 }
  const sorted = [...insights].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )
  const topInsights = sorted.slice(0, 3)

  return (
    <Card className="rounded-2xl border-border/80 shadow-card bg-card overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Financial Insights</h3>
              <p className="text-[11px] text-muted-foreground">
                {insights.length} data observation{insights.length === 1 ? '' : 's'} for this month
              </p>
            </div>
          </div>

          <Link
            to="/insights"
            className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 group transition-colors touch-target"
          >
            <span>View all insights</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Compact Cards List (Max 3) */}
        <div className="space-y-2">
          {topInsights.map((insight, idx) => (
            <InsightCard key={`${insight.type}-${insight.category || 'none'}-${idx}`} insight={insight} compact />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
