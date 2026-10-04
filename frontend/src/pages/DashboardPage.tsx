import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Wallet,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Utensils,
  Train,
  Home as HomeIcon,
  Tv,
  BookOpen,
  Briefcase,
  GraduationCap,
  Sparkles,
  Gift,
  ShieldCheck,
  ArrowRightLeft,
  RefreshCw,
  Bot,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionFormSheet } from '@/components/transactions/TransactionFormSheet'
import { transactionService } from '@/services/transactionService'
import { analyticsService, analyticsKeys } from '@/services/analyticsService'
import { reconciliationService } from '@/services/reconciliationService'
import { accountService } from '@/services/accountService'
import { MonthNavigator } from '@/components/analytics/MonthNavigator'
import { MonthlyOverviewSection } from '@/components/analytics/MonthlyOverviewSection'
import { CategorySpendingSection } from '@/components/analytics/CategorySpendingSection'
import { SpendingTrendSection } from '@/components/analytics/SpendingTrendSection'
import { DashboardBudgetOverview } from '@/components/budgets/DashboardBudgetOverview'
import { DashboardRecurringPreview } from '@/components/recurring/DashboardRecurringPreview'
import { DashboardForecastCard } from '@/components/forecast/DashboardForecastCard'
import { DashboardFinancialHealthCard } from '@/components/financialHealth/DashboardFinancialHealthCard'
import { DashboardAlertsCard } from '@/components/notifications/DashboardAlertsCard'
import { DashboardGoalsOverview } from '@/components/goals/DashboardGoalsOverview'
import { DashboardInsightsPreview } from '@/components/insights/DashboardInsightsPreview'
import { useAuth } from '@/hooks/useAuth'
import { formatINR } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/types/transaction'

function getCategoryIcon(category: string, type: TransactionType) {
  const cat = category.toLowerCase()
  if (type === 'income') {
    if (cat.includes('pocket')) return ArrowDownLeft
    if (cat.includes('salary')) return Briefcase
    if (cat.includes('stipend') || cat.includes('scholarship')) return GraduationCap
    if (cat.includes('gift')) return Gift
    return ArrowDownLeft
  }

  if (cat.includes('food')) return Utensils
  if (cat.includes('travel') || cat.includes('metro') || cat.includes('commute') || cat.includes('transport')) return Train
  if (cat.includes('rent') || cat.includes('hostel')) return HomeIcon
  if (cat.includes('book') || cat.includes('academic') || cat.includes('education')) return BookOpen
  if (cat.includes('bills') || cat.includes('recharge') || cat.includes('subscription')) return Tv
  if (cat.includes('fun') || cat.includes('entertainment')) return Sparkles
  return CreditCard
}

function formatLastSynced(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins === 1) return '1 min ago'
  if (diffMins < 60) return `${diffMins} mins ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  return date.toLocaleDateString()
}

export function DashboardPage() {
  const { user } = useAuth()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [defaultFormType, setDefaultFormType] = useState<TransactionType>('expense')

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date())

  const queryClient = useQueryClient()
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  // Bank sync freshness and balance reconciliation status
  const { data: syncFreshness } = useQuery({
    queryKey: ['sync-freshness'],
    queryFn: () => reconciliationService.getSyncFreshnessStatus(),
  })

  const syncAllMutation = useMutation({
    mutationFn: () => accountService.syncAll(),
    onMutate: () => {
      setIsSyncingAll(true)
      setSyncFeedback(null)
    },
    onSuccess: async (runs) => {
      const imported = runs.reduce((acc, r) => acc + (r.transactions_imported || 0), 0)
      const reconciled = runs.reduce((acc, r) => acc + (r.transactions_reconciled || 0), 0)
      setSyncFeedback(
        `Sync completed: ${imported} imported, ${reconciled} reconciled.`
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sync-freshness'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['connected-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-reconciliations'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ])
    },
    onError: (err: unknown) => {
      setSyncFeedback(
        err instanceof Error ? err.message : 'Sync failed. Please try again shortly.'
      )
    },
    onSettled: () => {
      setIsSyncingAll(false)
    },
  })

  // 1. Fetch live financial summary (Current Account State - All-time)
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => transactionService.getSummary(),
  })

  // 2. Fetch live selected-month analytics
  const {
    data: monthlyData,
    isLoading: isMonthlyLoading,
    isError: isMonthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: analyticsKeys.monthly({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getMonthly({ year: selectedYear, month: selectedMonth }),
  })

  // 3. Fetch live selected-month category breakdown
  const {
    data: categoryData,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
    refetch: refetchCategory,
  } = useQuery({
    queryKey: analyticsKeys.categories({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getCategories({ year: selectedYear, month: selectedMonth }),
  })

  // 4. Fetch live selected-month daily trend
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isError: isTrendError,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: analyticsKeys.trend({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getTrend({ year: selectedYear, month: selectedMonth }),
  })

  // 5. Fetch live recent transactions (up to 5)
  const {
    data: recentData,
    isLoading: isRecentLoading,
    isError: isRecentError,
  } = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionService.getTransactions({ limit: 5, offset: 0 }),
  })

  const recentTransactions: Transaction[] = recentData?.items || []

  const handleOpenAdd = (type: TransactionType = 'expense') => {
    setDefaultFormType(type)
    setIsFormOpen(true)
  }

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  const currentBalance = summary?.current_balance ?? '0.00'
  const startingBalance = summary?.starting_balance ?? '0.00'
  const totalIncome = summary?.total_income ?? '0.00'
  const totalExpenses = summary?.total_expenses ?? '0.00'
  const netCashFlow = summary?.net_cash_flow ?? '0.00'

  const greetingName = user?.full_name ? user.full_name.split(' ')[0] : 'Student'

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Greeting & Date & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Good morning{user?.full_name ? `, ${greetingName}` : ''}</span>
            <span className="text-2xl" role="img" aria-label="wave">
              👋
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{todayFormatted}</span>
            <span className="inline-block mx-1 text-border">·</span>
            <span className="text-primary font-medium">Campus Ledger</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenAdd('expense')}
            size="sm"
            className="rounded-xl shadow-xs font-semibold gap-1.5 touch-target h-10 px-4"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Urgent Notifications & Alerts Summary */}
      <DashboardAlertsCard />

      {/* SECTION: CURRENT ACCOUNT STATE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-muted-foreground">
            Current Account State
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            All-Time Ledger
          </span>
        </div>

        {/* 2. Main Financial Hero Card: "Current Balance" */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-blue-700 p-6 sm:p-7 text-white shadow-elevation">
          <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-12 top-4 h-20 w-20 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-blue-100/90">
                Current Balance
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-xs border border-white/20">
                Available funds
              </span>
            </div>

            <div className="space-y-1">
              {isSummaryLoading ? (
                <div className="h-12 w-48 bg-white/20 animate-pulse rounded-xl" />
              ) : isSummaryError ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-red-200">Unable to load balance</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchSummary()}
                    className="text-xs h-8 text-white border-white/30 hover:bg-white/20 rounded-xl"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : (
                <div className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {formatINR(currentBalance)}
                </div>
              )}
              <p className="text-xs sm:text-sm font-medium text-blue-100/90 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                <span>Starting balance + Total income − Total expenses</span>
              </p>
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-blue-100/80">
              <span>Verified from real ledger entries</span>
              <Link
                to="/activity"
                className="hover:text-white underline underline-offset-4 flex items-center gap-0.5 touch-target"
              >
                <span>View full ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Supporting Metric Cards: Starting Balance, Total Income, Total Spent, Net Cash Flow */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Starting Balance */}
          <Card className="rounded-2xl border-border/80 p-3 sm:p-4 bg-card hover:border-primary/30 transition-all">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center space-x-1 text-muted-foreground text-xs font-medium truncate">
                <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">Starting</span>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : isSummaryError ? (
                <span className="text-xs text-destructive">Error</span>
              ) : (
                <p className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                  {formatINR(startingBalance)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground truncate">From profile</p>
            </CardContent>
          </Card>

          {/* Total Income */}
          <Card className="rounded-2xl border-border/80 p-3 sm:p-4 bg-card hover:border-emerald-500/30 transition-all">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center space-x-1 text-muted-foreground text-xs font-medium truncate">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Income</span>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : isSummaryError ? (
                <span className="text-xs text-destructive">Error</span>
              ) : (
                <p className="text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                  {formatINR(totalIncome)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground truncate">Total received</p>
            </CardContent>
          </Card>

          {/* Total Expenses / Spent */}
          <Card className="rounded-2xl border-border/80 p-3 sm:p-4 bg-card hover:border-rose-500/30 transition-all">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center space-x-1 text-muted-foreground text-xs font-medium truncate">
                <CreditCard className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="truncate">Spent</span>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : isSummaryError ? (
                <span className="text-xs text-destructive">Error</span>
              ) : (
                <p className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                  {formatINR(totalExpenses)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground truncate">Total expenses</p>
            </CardContent>
          </Card>

          {/* Net Cash Flow */}
          <Card className="rounded-2xl border-border/80 p-3 sm:p-4 bg-card hover:border-primary/30 transition-all">
            <CardContent className="p-0 space-y-1">
              <div className="flex items-center space-x-1 text-muted-foreground text-xs font-medium truncate">
                <ArrowRightLeft className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">Net Cash Flow</span>
              </div>
              {isSummaryLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : isSummaryError ? (
                <span className="text-xs text-destructive">Error</span>
              ) : (
                <p className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                  {formatINR(netCashFlow)}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground truncate">All-time net</p>
            </CardContent>
          </Card>
        </div>

        {/* 4. Bank Synchronization & Balance Reconciliation Status */}
        {syncFreshness && syncFreshness.total_connected_accounts > 0 && (
          <Card className="rounded-2xl border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Connected Bank Sync
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                      {syncFreshness.total_connected_accounts} connected
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatLastSynced(syncFreshness.last_synced_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {syncFreshness.sync_status === 'SYNCING' || isSyncingAll ? (
                  <Badge variant="outline" className="text-[11px] py-0.5 px-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 font-medium">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Sync in progress...</span>
                  </Badge>
                ) : syncFreshness.is_stale || syncFreshness.sync_status === 'DELAYED' ? (
                  <Badge variant="outline" className="text-[11px] py-0.5 px-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Sync delayed</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Up to date</span>
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncAllMutation.mutate()}
                  disabled={isSyncingAll || syncFreshness.sync_status === 'SYNCING'}
                  className="h-8 text-xs rounded-xl px-3 font-medium gap-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </Button>
              </div>
            </div>

            {/* Reconciliation Comparison: Bank vs Ledger Balance */}
            <div className="rounded-xl bg-muted/40 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Connected Bank Balance</span>
                <span className="font-semibold text-foreground font-mono text-sm">
                  {formatINR(syncFreshness.total_bank_balance)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Ledger Balance (Authoritative)</span>
                <span className="font-semibold text-foreground font-mono text-sm">
                  {formatINR(syncFreshness.ledger_balance)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Reconciliation Difference</span>
                <span className={`font-semibold font-mono text-sm ${Math.abs(Number(syncFreshness.balance_difference)) > 0.01 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {Math.abs(Number(syncFreshness.balance_difference)) <= 0.01 ? 'Exact Match (₹0 difference)' : formatINR(Math.abs(Number(syncFreshness.balance_difference)))}
                </span>
              </div>
            </div>

            {/* Possible Duplicates Banner if any */}
            {syncFreshness.pending_reconciliations > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{syncFreshness.pending_reconciliations}</strong> possible duplicate transaction{syncFreshness.pending_reconciliations > 1 ? 's' : ''} detected from bank sync.
                  </span>
                </div>
                <Link
                  to="/activity"
                  className="font-semibold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5 shrink-0 ml-2"
                >
                  Review
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {syncFeedback && (
              <p className="text-[11px] text-muted-foreground italic">{syncFeedback}</p>
            )}
          </Card>
        )}
      </div>

      {/* SECTION: SELECTED MONTH NAVIGATION & OVERVIEW */}
      <div className="space-y-4 pt-2">
        <MonthNavigator
          year={selectedYear}
          month={selectedMonth}
          onChange={handleMonthChange}
          disabled={isMonthlyLoading}
        />

        <MonthlyOverviewSection
          data={monthlyData}
          isLoading={isMonthlyLoading}
          isError={isMonthlyError}
          onRetry={() => refetchMonthly()}
        />

        <DashboardBudgetOverview
          year={selectedYear}
          month={selectedMonth}
        />

        <DashboardRecurringPreview />

        <DashboardFinancialHealthCard />

        <DashboardForecastCard />

        <DashboardGoalsOverview />

        <DashboardInsightsPreview
          year={selectedYear}
          month={selectedMonth}
        />

        {/* Ask your Financial Copilot Card */}
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-purple-500/5 p-4 sm:p-5 hover:border-primary/40 transition-all shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-inner">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Ask your Financial Copilot</h3>
                <p className="text-xs text-muted-foreground">
                  Get instant natural-language explanations of your spending, budgets, and savings.
                </p>
              </div>
            </div>
            <Link
              to="/copilot"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs self-start sm:self-auto shrink-0"
            >
              Ask Copilot
              <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* SECTION: CHARTS (SPENDING BY CATEGORY & DAILY TREND) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategorySpendingSection
          data={categoryData}
          isLoading={isCategoryLoading}
          isError={isCategoryError}
          onRetry={() => refetchCategory()}
        />

        <SpendingTrendSection
          data={trendData}
          isLoading={isTrendLoading}
          isError={isTrendError}
          onRetry={() => refetchTrend()}
        />
      </div>

      {/* SECTION: INTEGRITY CALLOUT */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 sm:p-5 flex items-start space-x-3.5 transition-colors">
        <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-primary">
              Real-Time Ledger Active
            </span>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              Decimal-Safe
            </Badge>
          </div>
          <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-snug">
            All calculations are strictly derived from your authenticated database entries and starting balance. No simulated or mock figures.
          </p>
        </div>
      </div>

      {/* SECTION: RECENT ACTIVITY & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Activity */}
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
            {isRecentLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : isRecentError ? (
              <div className="p-6 text-center text-sm text-destructive">
                Failed to load recent activity.
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No recent transactions yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Start by recording an expense or allowance
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenAdd('expense')}
                  className="rounded-xl font-medium touch-target text-xs gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add your first transaction</span>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentTransactions.map((tx) => {
                  const isExpense = tx.transaction_type === 'expense'
                  const IconComponent = getCategoryIcon(tx.category, tx.transaction_type)
                  const displayDate = new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(tx.transaction_date))

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${isExpense
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {tx.description || tx.category}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {displayDate} · {tx.payment_method}
                          </p>
                        </div>
                      </div>

                      <div className="text-right pl-3 shrink-0">
                        <p
                          className={`text-sm sm:text-base font-bold tracking-tight ${isExpense
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
            )}
          </Card>
        </div>

        {/* Right Column: Quick Ledger Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Quick actions
            </h2>
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
              Instant Entry
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card
                onClick={() => handleOpenAdd('expense')}
                className="rounded-2xl border-border/80 p-4 hover:border-rose-500/40 hover:bg-muted/30 cursor-pointer transition-all touch-target"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Add Expense</p>
                    <p className="text-[11px] text-muted-foreground truncate">Food, travel, bills</p>
                  </div>
                </div>
              </Card>

              <Card
                onClick={() => handleOpenAdd('income')}
                className="rounded-2xl border-border/80 p-4 hover:border-emerald-500/40 hover:bg-muted/30 cursor-pointer transition-all touch-target"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Add Income</p>
                    <p className="text-[11px] text-muted-foreground truncate">Allowance, salary</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="rounded-2xl border-border/80 p-4.5 space-y-3 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ledger Statistics
                </span>
                <span className="text-xs font-medium text-primary">PostgreSQL</span>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Starting Balance</span>
                  <span className="font-semibold text-foreground font-mono">{formatINR(startingBalance)}</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Lifetime Income</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    +{formatINR(totalIncome)}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Lifetime Expenses</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">
                    -{formatINR(totalExpenses)}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between font-bold">
                  <span className="text-foreground">Net Ledger Balance</span>
                  <span className="text-foreground font-mono text-sm">{formatINR(currentBalance)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Transaction Modal / Bottom Sheet */}
      <TransactionFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        defaultType={defaultFormType}
      />
    </div>
  )
}
