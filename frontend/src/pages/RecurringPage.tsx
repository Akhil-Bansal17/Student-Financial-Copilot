import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  ArrowUpDown,
  CreditCard,
  Receipt,
  AlertCircle,
  TrendingUp,
  Sparkles,
  PlusCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState } from '@/components/common/ErrorState'
import { RecurringSummaryBanner } from '@/components/recurring/RecurringSummaryBanner'
import { RecurringExpenseCard } from '@/components/recurring/RecurringExpenseCard'
import { RecurringDetailDrawer } from '@/components/recurring/RecurringDetailDrawer'
import { RecurringEmptyState } from '@/components/recurring/RecurringEmptyState'
import { TransactionFormSheet } from '@/components/transactions/TransactionFormSheet'
import { recurringService, recurringKeys } from '@/services/recurringService'
import type { RecurringExpense } from '@/types/recurring'

type FilterTab =
  | 'ALL'
  | 'SUBSCRIPTIONS'
  | 'BILLS'
  | 'EXPENSES'
  | 'PRICE_CHANGES'
  | 'NEEDS_ATTENTION'

type SortOption = 'NEXT_DUE' | 'AMOUNT_DESC' | 'AMOUNT_ASC' | 'NAME_ASC'

export function RecurringPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('NEXT_DUE')
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpense | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddTxOpen, setIsAddTxOpen] = useState(false)

  // 1. Fetch recurring summary
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: recurringKeys.summary(),
    queryFn: () => recurringService.getSummary(),
  })

  // 2. Fetch all recurring expenses
  const {
    data: rawExpenses = [],
    isLoading: isExpensesLoading,
    isError: isExpensesError,
    error: expensesError,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: recurringKeys.lists(),
    queryFn: () => recurringService.getRecurringExpenses(),
  })

  // 3. Detect recurring mutation
  const detectMutation = useMutation({
    mutationFn: () => recurringService.detectRecurring(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recurringKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      ])
    },
  })

  const handleOpenDetail = (expense: RecurringExpense) => {
    setSelectedExpense(expense)
    setIsDetailOpen(true)
  }

  // Filter and sort items
  const filteredAndSortedExpenses = useMemo(() => {
    let items = [...rawExpenses]

    // Tab filtering
    if (activeTab === 'SUBSCRIPTIONS') {
      items = items.filter((x) => x.recurring_type === 'SUBSCRIPTION')
    } else if (activeTab === 'BILLS') {
      items = items.filter((x) => x.recurring_type === 'RECURRING_BILL')
    } else if (activeTab === 'EXPENSES') {
      items = items.filter(
        (x) => x.recurring_type === 'RECURRING_EXPENSE' || x.recurring_type === 'RECURRING_OTHER'
      )
    } else if (activeTab === 'PRICE_CHANGES') {
      items = items.filter((x) => Math.abs(Number(x.amount_change || 0)) > 0.01)
    } else if (activeTab === 'NEEDS_ATTENTION') {
      items = items.filter(
        (x) =>
          x.status === 'OVERDUE_EXPECTED' ||
          x.status === 'POSSIBLY_ENDED' ||
          Math.abs(Number(x.amount_change || 0)) > 0.01
      )
    }

    // Search term filtering
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      items = items.filter(
        (x) =>
          x.merchant.toLowerCase().includes(q) ||
          x.category.toLowerCase().includes(q) ||
          (x.notes && x.notes.toLowerCase().includes(q))
      )
    }

    // Sorting
    items.sort((a, b) => {
      if (sortBy === 'NEXT_DUE') {
        return (
          new Date(a.next_expected_date).getTime() - new Date(b.next_expected_date).getTime()
        )
      }
      if (sortBy === 'AMOUNT_DESC') {
        return Number(b.latest_amount) - Number(a.latest_amount)
      }
      if (sortBy === 'AMOUNT_ASC') {
        return Number(a.latest_amount) - Number(b.latest_amount)
      }
      if (sortBy === 'NAME_ASC') {
        return a.merchant.localeCompare(b.merchant)
      }
      return 0
    })

    return items
  }, [rawExpenses, activeTab, searchTerm, sortBy])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const subs = rawExpenses.filter((x) => x.recurring_type === 'SUBSCRIPTION').length
    const bills = rawExpenses.filter((x) => x.recurring_type === 'RECURRING_BILL').length
    const expenses = rawExpenses.filter(
      (x) => x.recurring_type === 'RECURRING_EXPENSE' || x.recurring_type === 'RECURRING_OTHER'
    ).length
    const priceChanges = rawExpenses.filter(
      (x) => Math.abs(Number(x.amount_change || 0)) > 0.01
    ).length
    const needsAttention = rawExpenses.filter(
      (x) =>
        x.status === 'OVERDUE_EXPECTED' ||
        x.status === 'POSSIBLY_ENDED' ||
        Math.abs(Number(x.amount_change || 0)) > 0.01
    ).length

    return {
      all: rawExpenses.length,
      subs,
      bills,
      expenses,
      priceChanges,
      needsAttention,
    }
  }, [rawExpenses])

  const isLoading = isSummaryLoading || isExpensesLoading

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Subscriptions & Recurring</span>
            <span className="text-xl" role="img" aria-label="repeat">
              🔄
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Deterministic tracking for campus bills, subscriptions, renewals & price changes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddTxOpen(true)}
            className="rounded-xl shadow-xs font-semibold gap-1.5 touch-target h-10 px-4"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* Summary Banner */}
      <RecurringSummaryBanner
        summary={summary}
        isLoading={isSummaryLoading}
        onDetect={() => detectMutation.mutate()}
        isDetecting={detectMutation.isPending}
      />

      {/* Filter Tabs & Search Controls */}
      <div className="space-y-3">
        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Button
            variant={activeTab === 'ALL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('ALL')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <span>All</span>
            <span className="text-[10px] opacity-80">({tabCounts.all})</span>
          </Button>

          <Button
            variant={activeTab === 'SUBSCRIPTIONS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('SUBSCRIPTIONS')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Subscriptions</span>
            <span className="text-[10px] opacity-80">({tabCounts.subs})</span>
          </Button>

          <Button
            variant={activeTab === 'BILLS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('BILLS')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Bills</span>
            <span className="text-[10px] opacity-80">({tabCounts.bills})</span>
          </Button>

          <Button
            variant={activeTab === 'EXPENSES' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('EXPENSES')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <span>Expenses</span>
            <span className="text-[10px] opacity-80">({tabCounts.expenses})</span>
          </Button>

          <Button
            variant={activeTab === 'PRICE_CHANGES' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('PRICE_CHANGES')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Price Changes</span>
            {tabCounts.priceChanges > 0 && (
              <Badge variant="warning" className="text-[9px] py-0 px-1 ml-0.5">
                {tabCounts.priceChanges}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeTab === 'NEEDS_ATTENTION' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('NEEDS_ATTENTION')}
            className="rounded-xl text-xs h-9 px-3 gap-1.5 shrink-0"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Needs Attention</span>
            {tabCounts.needsAttention > 0 && (
              <Badge variant="destructive" className="text-[9px] py-0 px-1 ml-0.5">
                {tabCounts.needsAttention}
              </Badge>
            )}
          </Button>
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by merchant, category, or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl text-xs bg-card border-border/80"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground bg-card border border-border/80 rounded-xl px-3 py-2">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <label htmlFor="sort-recurring" className="sr-only">Sort recurring expenses</label>
              <select
                id="sort-recurring"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-foreground text-xs focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="NEXT_DUE">Next Due (Earliest)</option>
                <option value="AMOUNT_DESC">Amount (Highest first)</option>
                <option value="AMOUNT_ASC">Amount (Lowest first)</option>
                <option value="NAME_ASC">Merchant (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16">
          <LoadingState message="Analyzing recurring patterns & subscriptions..." />
        </div>
      ) : isExpensesError ? (
        <ErrorState
          title="Could not load recurring expenses"
          message={
            expensesError instanceof Error
              ? expensesError.message
              : 'Please check your connection and try again.'
          }
          onRetry={() => {
            refetchSummary()
            refetchExpenses()
          }}
        />
      ) : rawExpenses.length === 0 ? (
        <RecurringEmptyState
          onDetect={() => detectMutation.mutate()}
          isDetecting={detectMutation.isPending}
          onAddTransaction={() => setIsAddTxOpen(true)}
        />
      ) : filteredAndSortedExpenses.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/80 p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            No recurring expenses match your active filter
          </p>
          <p className="text-xs text-muted-foreground">
            Try switching tabs or clearing your search term.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab('ALL')
              setSearchTerm('')
            }}
            className="text-xs rounded-xl mt-2"
          >
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              Showing {filteredAndSortedExpenses.length} recurring item
              {filteredAndSortedExpenses.length === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Multi-Tenant Isolated</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredAndSortedExpenses.map((expense) => (
              <RecurringExpenseCard
                key={expense.id}
                expense={expense}
                onClick={() => handleOpenDetail(expense)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <RecurringDetailDrawer
        key={selectedExpense?.id ?? 'none'}
        expense={selectedExpense}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedExpense(null)
        }}
      />

      {/* Quick Add Expense Modal */}
      <TransactionFormSheet
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        defaultType="expense"
      />
    </div>
  )
}
