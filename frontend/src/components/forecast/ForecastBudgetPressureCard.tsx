import { PieChart, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { ForecastBudgetPressure } from '@/types/forecast'

interface ForecastBudgetPressureCardProps {
  budgets: ForecastBudgetPressure[]
}

export function ForecastBudgetPressureCard({ budgets }: ForecastBudgetPressureCardProps) {
  if (budgets.length === 0) {
    return (
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 text-center space-y-2">
        <PieChart className="h-8 w-8 mx-auto text-slate-400 opacity-60" />
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No Monthly Budgets Configured
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Set up category spending limits in the Budgets tab to monitor projected spending pressure against your recurring commitments.
        </p>
      </Card>
    )
  }

  return (
    <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Budget Spending Pressure
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Combines actual recorded spending with upcoming recurring commitments for this month
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {budgets.map((b) => {
            const allocAmt = Number(b.allocated_amount)
            const spentAmt = Number(b.spent_amount)
            const recurringAmt = Number(b.projected_recurring_spend)
            const totalProj = Number(b.projected_total_spend)
            const utilPct = Number(b.utilization_percentage)

            return (
              <div
                key={b.budget_id}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-800/40 space-y-3"
                data-testid="forecast-budget-item"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      {b.category}
                    </h5>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                      Budget Limit: {formatINR(allocAmt, 0)}
                    </div>
                  </div>

                  {b.projected_over_budget ? (
                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px] px-2 py-0.5 gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Projected Over Budget
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] px-2 py-0.5 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      On Track
                    </Badge>
                  )}
                </div>

                {/* Stacked / Dual visual progress */}
                <div className="space-y-1">
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
                    {/* Actual spent segment */}
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, allocAmt > 0 ? (spentAmt / allocAmt) * 100 : 0)}%`,
                      }}
                      title={`Actual Spent: ${formatINR(spentAmt)}`}
                    />
                    {/* Projected recurring segment */}
                    <div
                      className="h-full bg-purple-400 dark:bg-purple-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          Math.max(0, 100 - (allocAmt > 0 ? (spentAmt / allocAmt) * 100 : 0)),
                          allocAmt > 0 ? (recurringAmt / allocAmt) * 100 : 0
                        )}%`,
                      }}
                      title={`Upcoming Recurring: ${formatINR(recurringAmt)}`}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      Actual: {formatINR(spentAmt, 0)} + Rec: {formatINR(recurringAmt, 0)}
                    </span>
                    <span className="font-semibold">{utilPct}% projected</span>
                  </div>
                </div>

                <div className="pt-1 text-xs border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Projected Total Month Spend:</span>
                  <span
                    className={`font-bold font-mono ${
                      b.projected_over_budget
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {formatINR(totalProj)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
