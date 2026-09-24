import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  BookOpen,
  Info,
  TrendingUp,
  Receipt,
  Scale,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { analyticsService, analyticsKeys } from '@/services/analyticsService'
import { MonthNavigator } from '@/components/analytics/MonthNavigator'
import { MonthlyOverviewSection } from '@/components/analytics/MonthlyOverviewSection'
import { CategorySpendingSection } from '@/components/analytics/CategorySpendingSection'
import { IncomeBreakdownSection } from '@/components/analytics/IncomeBreakdownSection'
import { SpendingTrendSection } from '@/components/analytics/SpendingTrendSection'
import { formatINR } from '@/lib/utils'

export function InsightsPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  // 1. Monthly Overview Query
  const {
    data: monthlyData,
    isLoading: isMonthlyLoading,
    isError: isMonthlyError,
    refetch: refetchMonthly,
  } = useQuery({
    queryKey: analyticsKeys.monthly({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getMonthly({ year: selectedYear, month: selectedMonth }),
  })

  // 2. Category Spending Query
  const {
    data: categoryData,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
    refetch: refetchCategory,
  } = useQuery({
    queryKey: analyticsKeys.categories({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getCategories({ year: selectedYear, month: selectedMonth }),
  })

  // 3. Income Breakdown Query
  const {
    data: incomeData,
    isLoading: isIncomeLoading,
    isError: isIncomeError,
    refetch: refetchIncome,
  } = useQuery({
    queryKey: analyticsKeys.incomeCategories({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getIncomeCategories({ year: selectedYear, month: selectedMonth }),
  })

  // 4. Trend Query
  const {
    data: trendData,
    isLoading: isTrendLoading,
    isError: isTrendError,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: analyticsKeys.trend({ year: selectedYear, month: selectedMonth }),
    queryFn: () => analyticsService.getTrend({ year: selectedYear, month: selectedMonth }),
  })

  // Deterministic facts calculations (strictly observational, no recommendations)
  const topExpenseCategory = categoryData?.items?.[0]
  const topIncomeCategory = incomeData?.items?.[0]

  const monthlyIncome = parseFloat(monthlyData?.monthly_income || '0')
  const monthlyExpenses = parseFloat(monthlyData?.monthly_expenses || '0')
  const expenseToIncomeRatio =
    monthlyIncome > 0
      ? ((monthlyExpenses / monthlyIncome) * 100).toFixed(1)
      : null

  const hasAnyMonthActivity =
    (monthlyData?.transaction_count ?? 0) > 0 ||
    monthlyIncome > 0 ||
    monthlyExpenses > 0

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>Financial Insights</span>
          <Sparkles className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Deterministic financial analytics derived strictly from verified database records
        </p>
      </div>

      {/* 2. Month Navigator */}
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={handleMonthChange}
        disabled={isMonthlyLoading}
      />

      {/* 3. Monthly Overview (Income, Expenses, Net Cash Flow, MoM comparison) */}
      <MonthlyOverviewSection
        data={monthlyData}
        isLoading={isMonthlyLoading}
        isError={isMonthlyError}
        onRetry={() => refetchMonthly()}
      />

      {/* 4. Deterministic Factual Highlights (No AI advice, neutral factual summaries) */}
      {hasAnyMonthActivity && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-1">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-muted-foreground">
              Month Highlights
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Fact 1: Top Expense Category */}
            {topExpenseCategory && (
              <Card className="rounded-2xl border-border/80 p-3.5 bg-card">
                <CardContent className="p-0 flex items-start space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Primary Expense: {topExpenseCategory.category}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {topExpenseCategory.category} represents {topExpenseCategory.percentage}% of this month's expenses ({formatINR(topExpenseCategory.amount)}).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fact 2: Primary Income Source */}
            {topIncomeCategory && (
              <Card className="rounded-2xl border-border/80 p-3.5 bg-card">
                <CardContent className="p-0 flex items-start space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Primary Income: {topIncomeCategory.category}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {topIncomeCategory.category} represents {topIncomeCategory.percentage}% of recorded monthly inflows ({formatINR(topIncomeCategory.amount)}).
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fact 3: Expense to Income Ratio */}
            {expenseToIncomeRatio !== null && (
              <Card className="rounded-2xl border-border/80 p-3.5 bg-card sm:col-span-2 lg:col-span-1">
                <CardContent className="p-0 flex items-start space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Cash Flow Proportion
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      Total expenses accounted for {expenseToIncomeRatio}% of this month's recorded income.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 5. Spending by Category & Income by Source */}
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

      {/* 6. Spending Trend (Daily Income vs Expenses) */}
      <SpendingTrendSection
        data={trendData}
        isLoading={isTrendLoading}
        isError={isTrendError}
        onRetry={() => refetchTrend()}
      />

      {/* 7. Architecture / Deterministic Principles Note */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 sm:p-5 flex items-start space-x-3.5">
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
            All analytics, category distributions, and daily trends are computed deterministically by PostgreSQL aggregations.
            No speculative estimates or simulated metrics are displayed.
          </p>
        </div>
      </div>
    </div>
  )
}
