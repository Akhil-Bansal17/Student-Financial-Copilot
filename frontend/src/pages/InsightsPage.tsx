import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Info,
  Layers,
  Wallet,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthNavigator } from '@/components/analytics/MonthNavigator'
import { CategorySpendingSection } from '@/components/analytics/CategorySpendingSection'
import { IncomeBreakdownSection } from '@/components/analytics/IncomeBreakdownSection'
import { SpendingTrendSection } from '@/components/analytics/SpendingTrendSection'
import { InsightCard } from '@/components/insights/InsightCard'
import { insightService, insightKeys } from '@/services/insightService'
import { analyticsService, analyticsKeys } from '@/services/analyticsService'
import { formatINR } from '@/lib/utils'
import type { FinancialInsight } from '@/types/insight'

type InsightFilter = 'all' | 'warning' | 'positive' | 'info' | 'spending' | 'budget_goal' | 'recurring'

export function InsightsPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [activeFilter, setActiveFilter] = useState<InsightFilter>('all')

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  // 1. Insights Query
  const {
    data: insightsData,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    error: insightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: insightKeys.period(selectedYear, selectedMonth),
    queryFn: () => insightService.getInsights(selectedYear, selectedMonth),
  })

  // 2. Monthly Summary Analytics Query (Phase 3 analytics integration)
  const { data: monthlyData } = useQuery({
    queryKey: analyticsKeys.monthly({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getMonthly({ year: selectedYear, month: selectedMonth }),
  })

  // 3. Category Spending Query (for detailed breakdown & primary expense)
  const {
    data: categoryData,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
    refetch: refetchCategory,
  } = useQuery({
    queryKey: analyticsKeys.categories({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getCategories({ year: selectedYear, month: selectedMonth }),
  })

  // 4. Income Breakdown Query (for detailed breakdown & primary income)
  const {
    data: incomeData,
    isLoading: isIncomeLoading,
    isError: isIncomeError,
    refetch: refetchIncome,
  } = useQuery({
    queryKey: analyticsKeys.incomeCategories({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getIncomeCategories({ year: selectedYear, month: selectedMonth }),
  })

  // 5. Trend Query (for daily line chart)
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isError: isTrendError,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: analyticsKeys.trend({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getTrend({ year: selectedYear, month: selectedMonth }),
  })

  const filterInsight = (item: FinancialInsight): boolean => {
    switch (activeFilter) {
      case 'warning':
        return item.priority === 'warning'
      case 'positive':
        return item.priority === 'positive'
      case 'info':
        return item.priority === 'info'
      case 'spending':
        return (
          item.type === 'top_category' ||
          item.type === 'spending_trend' ||
          item.type === 'spending_concentration' ||
          item.type === 'monthly_change'
        )
      case 'budget_goal':
        return item.type === 'budget' || item.type === 'goal'
      case 'recurring':
        return item.type === 'recurring_pattern'
      case 'all':
      default:
        return true
    }
  }

  const allInsights = insightsData?.insights || []
  const filteredInsights = allInsights.filter(filterInsight)
  const summary = insightsData?.summary

  // Phase 3 Factual Calculations
  const primaryExpense = categoryData?.items?.[0]
  const primaryIncome = incomeData?.items?.[0]
  const monthlyExpenses = monthlyData?.monthly_expenses ? parseFloat(monthlyData.monthly_expenses) : 0
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  const dailyAverageSpend = (monthlyExpenses / daysInMonth).toFixed(2)
  const netCashFlow = monthlyData?.monthly_net_cash_flow ? parseFloat(monthlyData.monthly_net_cash_flow) : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>Financial Insights</span>
          <Sparkles className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Deterministic financial observations derived strictly from verified database records
        </p>
      </div>

      {/* 2. Month Navigator */}
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={handleMonthChange}
        disabled={isInsightsLoading}
      />

      {/* 3. Section: Financial Overview (Phase 3 Core Highlights) */}
      {(primaryExpense || primaryIncome || monthlyData) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span>Financial Overview</span>
            </h2>
            <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
              Deterministic Core
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Primary Expense */}
            {primaryExpense && (
              <Card className="rounded-2xl border-border/80 p-4 bg-card shadow-xs">
                <CardContent className="p-0 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium block">
                    Primary Expense: {primaryExpense.category}
                  </span>
                  <p className="text-base sm:text-lg font-bold text-foreground">
                    {formatINR(primaryExpense.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {primaryExpense.category} represents {primaryExpense.percentage}% of this month's expenses
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Primary Income */}
            {primaryIncome && (
              <Card className="rounded-2xl border-border/80 p-4 bg-card shadow-xs">
                <CardContent className="p-0 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium block">
                    Primary Income: {primaryIncome.category}
                  </span>
                  <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(primaryIncome.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {primaryIncome.category} represents {primaryIncome.percentage}% of recorded monthly inflows
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Daily Average Spend */}
            <Card className="rounded-2xl border-border/80 p-4 bg-card shadow-xs">
              <CardContent className="p-0 space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Daily Average Spend
                </span>
                <p className="text-base sm:text-lg font-bold text-foreground">
                  {formatINR(dailyAverageSpend)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Across {daysInMonth} calendar days
                </p>
              </CardContent>
            </Card>

            {/* Net Cash Flow */}
            <Card className="rounded-2xl border-border/80 p-4 bg-card shadow-xs">
              <CardContent className="p-0 space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">
                  Net Cash Flow
                </span>
                <p className={`text-base sm:text-lg font-bold ${netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatINR(netCashFlow)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {netCashFlow >= 0 ? 'Surplus this month' : 'Deficit this month'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 4. Loading State for Insights */}
      {isInsightsLoading && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/80 p-5 space-y-3">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        </div>
      )}

      {/* 5. Error State for Insights */}
      {isInsightsError && (
        <Card className="rounded-2xl border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-destructive">
              Failed to load financial insights
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {insightsError instanceof Error ? insightsError.message : 'Unable to load financial insights. Please check connection and try again.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchInsights()}
            className="rounded-xl gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </Card>
      )}

      {/* 6. Main Insights Observations */}
      {!isInsightsLoading && !isInsightsError && (
        <>
          {/* Summary Highlights Banner (when insights exist) */}
          {summary && summary.has_sufficient_data && allInsights.length > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-xs bg-gradient-to-r from-card via-card to-primary/5 overflow-hidden">
              <CardContent className="p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Monthly Observation Summary</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Deterministic observations from verified account transactions.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 border-primary/30 text-primary">
                    Deterministic Engine
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Total Findings</span>
                    <span className="font-bold text-foreground text-sm truncate block">
                      {summary.total_insights_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Positive Notes</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm truncate block">
                      {summary.positive_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">Action Notices</span>
                    <span className={`font-bold text-sm truncate block ${summary.warning_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                      {summary.warning_count}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter Tabs */}
          {summary && summary.has_sufficient_data && allInsights.length > 0 && (
            <div className="flex items-center space-x-1 border-b border-border/60 pb-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] opacity-80">({summary.total_insights_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('positive')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'positive'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Positive</span>
                <span className="text-[10px] opacity-80">({summary.positive_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('warning')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'warning'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Warnings</span>
                <span className="text-[10px] opacity-80">({summary.warning_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('info')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'info'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Info className="h-3 w-3" />
                <span>Info</span>
                <span className="text-[10px] opacity-80">({summary.info_count})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('spending')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'spending'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>Spending Trends</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('budget_goal')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'budget_goal'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Wallet className="h-3 w-3" />
                <span>Budgets & Goals</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('recurring')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeFilter === 'recurring'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <RefreshCw className="h-3 w-3" />
                <span>Recurring</span>
              </button>
            </div>
          )}

          {/* Insights Cards Grid / Empty State */}
          {!summary?.has_sufficient_data || allInsights.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-2 border-border/80 p-8 sm:p-12 text-center bg-card/40">
              <div className="max-w-md mx-auto space-y-3.5">
                <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    No financial insights yet
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Add more transactions, budgets, or savings goals to uncover spending patterns.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/activity"
                    className="inline-flex items-center justify-center rounded-xl font-medium transition-colors bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 h-9 px-3 text-xs"
                  >
                    Add Transaction
                  </Link>
                </div>
              </div>
            </Card>
          ) : filteredInsights.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-2 border-border/80 p-8 text-center bg-card/40">
              <div className="max-w-sm mx-auto space-y-3">
                <div className="h-10 w-10 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    No insights matching filter
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    There are no observations under this specific classification.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveFilter('all')}
                  className="rounded-xl text-xs"
                >
                  View All Insights
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}

          {/* Section: Visual Analytics Breakdown Charts */}
          <div className="pt-4 border-t border-border/60 space-y-6">
            <div className="flex items-center gap-1.5 px-1">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-muted-foreground">
                Visual Ledger Distributions
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategorySpendingSection
                data={categoryData}
                isLoading={isCategoryLoading}
                isError={isCategoryError}
                onRetry={() => refetchCategory()}
              />

              <IncomeBreakdownSection
                data={incomeData}
                isLoading={isIncomeLoading}
                isError={isIncomeError}
                onRetry={() => refetchIncome()}
              />
            </div>

            <SpendingTrendSection
              data={trendData}
              isLoading={isTrendLoading}
              isError={isTrendError}
              onRetry={() => refetchTrend()}
            />
          </div>
        </>
      )}
    </div>
  )
}
