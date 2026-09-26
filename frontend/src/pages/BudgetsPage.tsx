import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthNavigator } from '@/components/analytics/MonthNavigator'
import { OverallBudgetCard } from '@/components/budgets/OverallBudgetCard'
import { CategoryBudgetCard } from '@/components/budgets/CategoryBudgetCard'
import { BudgetFormSheet } from '@/components/budgets/BudgetFormSheet'
import { budgetService, budgetKeys } from '@/services/budgetService'
import { queryClient } from '@/lib/queryClient'
import type { BudgetCategorySummary } from '@/types/budget'

export function BudgetsPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)

  // Sheet State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<{
    id?: number
    category: string | null
    amount: string
    year: number
    month: number
  } | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Fetch Budget Summary for selected month
  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: budgetKeys.summary(selectedYear, selectedMonth),
    queryFn: () => budgetService.getBudgetSummary(selectedYear, selectedMonth),
  })

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  const handleOpenAddOverall = () => {
    setEditingBudget(null)
    setDefaultCategory(null)
    setIsFormOpen(true)
  }

  const handleOpenAddCategory = () => {
    setEditingBudget(null)
    setDefaultCategory('Food')
    setIsFormOpen(true)
  }

  const handleEditOverall = () => {
    if (!summary?.overall_budget_id) return
    setEditingBudget({
      id: summary.overall_budget_id,
      category: null,
      amount: summary.overall_budget || '0',
      year: selectedYear,
      month: selectedMonth,
    })
    setIsFormOpen(true)
  }

  const handleEditCategory = (cat: BudgetCategorySummary) => {
    setEditingBudget({
      id: cat.id,
      category: cat.category,
      amount: cat.budget,
      year: selectedYear,
      month: selectedMonth,
    })
    setIsFormOpen(true)
  }

  const handleDeleteBudget = async (id: number) => {
    try {
      setDeletingId(id)
      await budgetService.deleteBudget(id)
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Budgets & Spending Limits
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Define monthly allowances, control category spending, and prevent overshoots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenAddCategory}
            className="rounded-xl gap-1.5 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Budget</span>
          </Button>
        </div>
      </div>

      {/* 2. Month Selector */}
      <MonthNavigator
        year={selectedYear}
        month={selectedMonth}
        onChange={handleMonthChange}
      />

      {/* 3. Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/80 p-5 space-y-4">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        </div>
      )}

      {/* 4. Error State */}
      {isError && (
        <Card className="rounded-2xl border-destructive/20 bg-destructive/10 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-destructive">
              Failed to load budget data
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Please check your connection and try again.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="rounded-xl gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </Card>
      )}

      {/* 5. Main Content */}
      {!isLoading && !isError && summary && (
        <div className="space-y-6">
          {/* Section: Overall Monthly Budget */}
          <div className="space-y-2">
            <OverallBudgetCard
              overallBudget={summary.overall_budget}
              overallBudgetId={summary.overall_budget_id}
              overallSpending={summary.overall_spending}
              overallRemaining={summary.overall_remaining}
              overallUtilization={summary.overall_utilization}
              overallOverBudget={summary.overall_over_budget}
              onEdit={handleEditOverall}
              onDelete={handleDeleteBudget}
              onSetBudget={handleOpenAddOverall}
              isDeleting={deletingId === summary.overall_budget_id}
            />
          </div>

          {/* Section: Category Budgets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Category Spending Limits</h2>
                <p className="text-xs text-muted-foreground">
                  Individual spending caps for specific expense types
                </p>
              </div>

              {summary.category_budgets.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenAddCategory}
                  className="rounded-xl text-xs gap-1.5 h-8"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Category</span>
                </Button>
              )}
            </div>

            {summary.category_budgets.length === 0 ? (
              /* Empty Category Budgets State */
              <Card className="rounded-2xl border-dashed border-2 border-border/80 p-8 text-center bg-card/40">
                <div className="max-w-sm mx-auto space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      No category budgets set for this month
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Set specific limits for Food, Transport, Hostel, and Entertainment to manage daily student expenses with precision.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleOpenAddCategory}
                    className="rounded-xl gap-1.5 text-xs shadow-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Create Category Budget</span>
                  </Button>
                </div>
              </Card>
            ) : (
              /* Grid of Category Budgets */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {summary.category_budgets.map((catSummary) => (
                  <CategoryBudgetCard
                    key={catSummary.id}
                    summary={catSummary}
                    onEdit={() => handleEditCategory(catSummary)}
                    onDelete={handleDeleteBudget}
                    isDeleting={deletingId === catSummary.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget Form Sheet for Create / Edit */}
      <BudgetFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingBudget(null)
          setDefaultCategory(null)
        }}
        initialBudget={editingBudget}
        defaultYear={selectedYear}
        defaultMonth={selectedMonth}
        defaultCategory={defaultCategory}
      />
    </div>
  )
}
