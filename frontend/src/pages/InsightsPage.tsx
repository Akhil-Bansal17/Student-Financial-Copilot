import { Sparkles, TrendingDown, PieChart, ShieldAlert, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'

export function InsightsPage() {
  const categoryBreakdown = [
    { category: 'Hostel & Rent', amount: 2000, percentage: 35, color: 'bg-indigo-500' },
    { category: 'Food & Dining', amount: 1850, percentage: 32, color: 'bg-rose-500' },
    { category: 'Transit & Metro', amount: 620, percentage: 11, color: 'bg-amber-500' },
    { category: 'Academics & Books', amount: 750, percentage: 13, color: 'bg-emerald-500' },
    { category: 'Entertainment & Subs', amount: 500, percentage: 9, color: 'bg-blue-400' },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>Financial Insights</span>
          <Sparkles className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Evidence-based analysis derived from verified backend domain calculations
        </p>
      </div>

      {/* AI Copilot Architecture Callout */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 flex items-start space-x-3.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Core Copilot Principle
            </span>
            <Badge variant="outline" className="text-[10px]">Deterministic Core</Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            All balances, category burn rates, and allowances are computed by deterministic backend logic.
            The future AI Copilot generates actionable natural-language guidance grounded entirely on these verified facts.
          </p>
        </div>
      </div>

      {/* Spending Breakdown */}
      <Card className="rounded-2xl border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-primary" />
                <span>Monthly Category Burn</span>
              </CardTitle>
              <CardDescription>Breakdown for current academic month</CardDescription>
            </div>
            <span className="text-sm font-bold text-foreground">{formatINR(5720)}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stacked Progress Bar */}
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category}
                style={{ width: `${item.percentage}%` }}
                className={`h-full ${item.color}`}
                title={`${item.category}: ${item.percentage}%`}
              />
            ))}
          </div>

          {/* Legend Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {categoryBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/30">
                <div className="flex items-center space-x-2 truncate">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className="font-medium text-foreground truncate">{item.category}</span>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className="font-semibold text-foreground">{formatINR(item.amount)}</span>
                  <span className="text-muted-foreground ml-1">({item.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nudge Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/80 p-4">
          <div className="flex items-start space-x-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Transit Efficiency</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Metro travel expenses are 18% lower than last month thanks to your monthly student pass.
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/80 p-4">
          <div className="flex items-start space-x-3">
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Canteen Pacing</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Food orders peak on Thursday evenings. Setting a daily ₹150 cap would save ₹800 this month.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
