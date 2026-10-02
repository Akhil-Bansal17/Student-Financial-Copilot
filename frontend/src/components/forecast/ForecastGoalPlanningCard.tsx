import { Target, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { ForecastGoalPlanning } from '@/types/forecast'

interface ForecastGoalPlanningCardProps {
  goals: ForecastGoalPlanning[]
}

export function ForecastGoalPlanningCard({ goals }: ForecastGoalPlanningCardProps) {
  if (goals.length === 0) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 text-center space-y-2">
        <Target className="h-8 w-8 mx-auto text-slate-400 opacity-60" />
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No Active Goals Found
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Create savings goals in the Goals tab to see how your forecasted cash flow supports your target completion timelines.
        </p>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Goal Cash Flow Planning
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deterministic monthly allocation feasibility based on your estimated cash surplus
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {goals.map((g) => {
            const targetAmt = Number(g.target_amount)
            const currentAmt = Number(g.current_amount)
            const remainingAmt = Number(g.remaining_amount)
            const suggAlloc = g.suggested_monthly_allocation
              ? Number(g.suggested_monthly_allocation)
              : null
            const progress = targetAmt > 0 ? Math.round((currentAmt / targetAmt) * 100) : 0

            return (
              <div
                key={g.goal_id}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-800/40 space-y-3"
                data-testid="forecast-goal-item"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      {g.goal_name}
                    </h5>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                      Target: {formatINR(targetAmt, 0)} • Saved: {formatINR(currentAmt, 0)}
                    </div>
                  </div>

                  {g.is_affordable ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] px-2 py-0.5 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Affordable
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] px-2 py-0.5 gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Needs Buffer
                    </Badge>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{progress}% completed</span>
                    <span>Remaining: {formatINR(remainingAmt, 0)}</span>
                  </div>
                </div>

                {/* Suggested Monthly Allocation */}
                {suggAlloc !== null && (
                  <div className="pt-1 text-xs border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Suggested Monthly Contribution:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {formatINR(suggAlloc, 0)}/mo
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
