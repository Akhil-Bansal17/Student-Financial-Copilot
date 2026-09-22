import { Link } from 'react-router-dom'
import {
  Utensils,
  Train,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  Tv,
  Home as HomeIcon,
  ChevronRight,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Wallet,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import {
  MOCK_FINANCIAL_SUMMARY,
  MOCK_RECENT_TRANSACTIONS,
  MOCK_MONEY_INSIGHT,
  MOCK_UPCOMING_EXPENSES,
} from '@/mock/dashboardData'

export function DashboardPage() {
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date())

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Greeting & Date */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Good morning</span>
            <span className="text-2xl" role="img" aria-label="wave">
              👋
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{todayFormatted}</span>
            <span className="inline-block mx-1 text-border">·</span>
            <span className="text-primary font-medium">Campus Term</span>
          </p>
        </div>
      </div>

      {/* 2. Main Financial Hero Card: "Safe to spend" */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-blue-700 p-6 sm:p-7 text-white shadow-elevation">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-12 top-4 h-20 w-20 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-blue-100/90">
              Safe to spend
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-xs border border-white/20">
              Daily allowance
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              {formatINR(MOCK_FINANCIAL_SUMMARY.safeToSpend)}
            </div>
            <p className="text-sm font-medium text-blue-100/90 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>{MOCK_FINANCIAL_SUMMARY.statusNote}</span>
            </p>
          </div>

          <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-blue-100/80">
            <span>Resets tomorrow at 6:00 AM</span>
            <Link
              to="/insights"
              className="hover:text-white underline underline-offset-4 flex items-center gap-0.5 touch-target"
            >
              <span>How it's calculated</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Three Supporting Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Available Balance */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-primary/30 transition-all">
          <CardContent className="p-0 space-y-1">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium truncate">
              <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">Available</span>
            </div>
            <p className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              {formatINR(MOCK_FINANCIAL_SUMMARY.availableBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground hidden xs:block truncate">Bank & UPI</p>
          </CardContent>
        </Card>

        {/* Spent this month */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-primary/30 transition-all">
          <CardContent className="p-0 space-y-1">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium truncate">
              <CreditCard className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Spent</span>
            </div>
            <p className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              {formatINR(MOCK_FINANCIAL_SUMMARY.spentThisMonth)}
            </p>
            <p className="text-[10px] text-muted-foreground hidden xs:block truncate">This month</p>
          </CardContent>
        </Card>

        {/* Savings */}
        <Card className="rounded-2xl border-border/80 p-3.5 sm:p-4 bg-card hover:border-primary/30 transition-all">
          <CardContent className="p-0 space-y-1">
            <div className="flex items-center space-x-1.5 text-muted-foreground text-[11px] sm:text-xs font-medium truncate">
              <PiggyBank className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Savings</span>
            </div>
            <p className="text-base sm:text-xl font-bold tracking-tight text-foreground truncate">
              {formatINR(MOCK_FINANCIAL_SUMMARY.savings)}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hidden xs:block truncate">
              +12% target
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Money Insight Card */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 sm:p-5 flex items-start space-x-3.5 transition-colors">
        <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-800 dark:text-amber-300">
              {MOCK_MONEY_INSIGHT.badgeText}
            </span>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400">Deterministic Alert</span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-amber-950 dark:text-amber-100 leading-snug">
            {MOCK_MONEY_INSIGHT.message}
          </p>
        </div>
      </div>

      {/* 5. Two-column grid on desktop, single column on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Recent activity
            </h2>
            <Link
              to="/activity"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 touch-target"
            >
              <span>View all</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Card className="rounded-2xl overflow-hidden border-border/80">
            <div className="divide-y divide-border/60">
              {MOCK_RECENT_TRANSACTIONS.map((tx) => {
                const isExpense = tx.type === 'expense'

                let IconComponent = Utensils
                if (tx.title.toLowerCase().includes('metro')) {
                  IconComponent = Train
                } else if (tx.title.toLowerCase().includes('pocket')) {
                  IconComponent = ArrowDownLeft
                }

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          isExpense
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{tx.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{tx.date}</p>
                      </div>
                    </div>

                    <div className="text-right pl-3 shrink-0">
                      <p
                        className={`text-sm sm:text-base font-bold tracking-tight ${
                          isExpense
                            ? 'text-foreground'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isExpense ? `-${formatINR(tx.amount)}` : `+${formatINR(tx.amount)}`}
                      </p>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {tx.category}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Upcoming Expenses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Upcoming expenses
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
              Next 14 Days
            </Badge>
          </div>

          <div className="space-y-2.5">
            {MOCK_UPCOMING_EXPENSES.map((expense) => {
              const isHostel = expense.title.toLowerCase().includes('hostel')
              const Icon = isHostel ? HomeIcon : Tv

              return (
                <Card
                  key={expense.id}
                  className="rounded-2xl border-border/80 p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {expense.title}
                        </p>
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          Due {expense.dueDate}
                        </span>
                      </div>
                    </div>

                    <div className="text-right pl-3 shrink-0">
                      <p className="text-sm sm:text-base font-bold text-foreground">
                        {formatINR(expense.amount)}
                      </p>
                      <Badge variant="secondary" className="text-[10px] py-0 px-2">
                        {expense.category}
                      </Badge>
                    </div>
                  </div>
                </Card>
              )
            })}

            {/* Quick Helper / Milestone Banner */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                <span>Total upcoming: <strong>{formatINR(2149)}</strong></span>
              </div>
              <span className="text-[11px] font-medium text-primary">Covered in budget</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
