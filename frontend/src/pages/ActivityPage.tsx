import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Edit2,
  Trash2,
  Calendar,
  AlertTriangle,
  Loader2,
  GitCompare,
  CheckSquare,
  Square,
  X,
  SlidersHorizontal,
  Check,
  Tag,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TransactionFormSheet } from '@/components/transactions/TransactionFormSheet'
import { TransactionDetailSheet } from '@/components/transactions/TransactionDetailSheet'
import { formatINR } from '@/lib/utils'
import { transactionService } from '@/services/transactionService'
import { reconciliationService } from '@/services/reconciliationService'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Transaction,
  type TransactionType,
} from '@/types/transaction'

const FILTER_TYPES: { label: string; value: 'all' | 'expense' | 'income' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expenses', value: 'expense' },
  { label: 'Income', value: 'income' },
]

const ALL_AVAILABLE_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
).sort()

export function ActivityPage() {
  const queryClient = useQueryClient()
  // Primary filter state
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [limit] = useState(50)

  // Sheet states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState<string>('Food')
  const [bulkRememberPreference, setBulkRememberPreference] = useState(true)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Deletion state
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Query transactions with server-side filters
  const {
    data: txData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'transactions',
      selectedType,
      selectedCategory,
      selectedSource,
      searchTerm,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      limit,
    ],
    queryFn: () =>
      transactionService.getTransactions({
        transaction_type: selectedType === 'all' ? undefined : (selectedType as TransactionType),
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        source: selectedSource === 'all' ? undefined : selectedSource,
        search: searchTerm.trim() ? searchTerm.trim() : undefined,
        min_amount: minAmount ? parseFloat(minAmount) : undefined,
        max_amount: maxAmount ? parseFloat(maxAmount) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit,
        offset: 0,
      }),
  })

  // Reconciliation query
  const [reconcilingId, setReconcilingId] = useState<number | null>(null)
  const [reconcileAction, setReconcileAction] = useState<'match' | 'separate' | null>(null)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)

  const { data: pendingReconciliations = [] } = useQuery({
    queryKey: ['pending-reconciliations'],
    queryFn: () => reconciliationService.getPendingReconciliations(),
  })

  const handleOpenAdd = () => {
    setEditingTransaction(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTransaction(tx)
    setIsFormOpen(true)
  }

  const handleOpenDetail = (tx: Transaction) => {
    if (isSelectionMode) {
      handleToggleSelect(tx.id)
      return
    }
    setDetailTransaction(tx)
    setIsDetailOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      setDeleteError(null)
      await transactionService.deleteTransaction(id)
      setDeleteConfirmId(null)
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError('Failed to delete transaction.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleMatch = async (id: number) => {
    try {
      setReconcilingId(id)
      setReconcileAction('match')
      setReconciliationError(null)
      await reconciliationService.matchReconciliation(id)
      await queryClient.invalidateQueries({ queryKey: ['pending-reconciliations'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
    } catch (err: unknown) {
      setReconciliationError(err instanceof Error ? err.message : 'Failed to match transaction.')
    } finally {
      setReconcilingId(null)
      setReconcileAction(null)
    }
  }

  const handleKeepSeparate = async (id: number) => {
    try {
      setReconcilingId(id)
      setReconcileAction('separate')
      setReconciliationError(null)
      await reconciliationService.keepSeparateReconciliation(id)
      await queryClient.invalidateQueries({ queryKey: ['pending-reconciliations'] })
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
    } catch (err: unknown) {
      setReconciliationError(err instanceof Error ? err.message : 'Failed to separate transaction.')
    } finally {
      setReconcilingId(null)
      setReconcileAction(null)
    }
  }

  // Bulk actions
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    const rawItems = txData?.items || []
    if (selectedIds.size === rawItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rawItems.map((tx) => tx.id)))
    }
  }

  const handleBulkCategorySubmit = async () => {
    if (selectedIds.size === 0) return
    try {
      setIsBulkUpdating(true)
      setBulkError(null)
      setBulkMessage(null)

      const res = await transactionService.bulkUpdateCategory({
        transaction_ids: Array.from(selectedIds),
        category: bulkCategory,
        update_merchant_preference: bulkRememberPreference,
      })

      setBulkMessage(`Updated ${res.updated_count} transaction(s) to ${res.category}`)
      setIsBulkModalOpen(false)
      setSelectedIds(new Set())
      setIsSelectionMode(false)

      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
      await queryClient.invalidateQueries({ queryKey: ['merchant-preferences'] })
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : 'Failed to bulk update categories')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleResetFilters = () => {
    setSelectedType('all')
    setSelectedCategory('all')
    setSelectedSource('all')
    setSearchTerm('')
    setMinAmount('')
    setMaxAmount('')
    setStartDate('')
    setEndDate('')
  }

  const activeFiltersCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedSource !== 'all' ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0)

  const rawItems = txData?.items || []
  const totalCount = txData?.total || 0

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Activity & Transactions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track student expenditures, allowances, and normalized bank sync records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isSelectionMode ? 'secondary' : 'outline'}
            onClick={() => {
              setIsSelectionMode(!isSelectionMode)
              if (isSelectionMode) setSelectedIds(new Set())
            }}
            className="gap-1.5 rounded-xl text-xs h-9"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{isSelectionMode ? 'Cancel Selection' : 'Select'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-1.5 rounded-xl shadow-xs text-xs h-9"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Record</span>
          </Button>
        </div>
      </div>

      {/* Delete / Bulk Notifications */}
      {deleteError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-in fade-in"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {bulkMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{bulkMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBulkMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {bulkError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-in fade-in"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{bulkError}</span>
        </div>
      )}

      {/* Possible Duplicate Transactions Review Section */}
      {pendingReconciliations.length > 0 && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Possible Duplicate Transactions ({pendingReconciliations.length})
              </h2>
            </div>
            <Badge variant="outline" className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Needs Review
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            We detected bank transactions that might correspond to your manual entries. Match them to avoid double counting, or keep them separate.
          </p>

          {reconciliationError && (
            <div role="alert" className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{reconciliationError}</span>
            </div>
          )}

          <div className="space-y-2.5">
            {pendingReconciliations.map((item) => (
              <Card key={item.id} className="p-3.5 rounded-xl border-amber-500/30 bg-amber-500/5 space-y-3 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left: Manual Entry */}
                  <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Manual Entry</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground">
                        {item.manual_category}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {formatINR(item.manual_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.manual_description || 'Manual transaction'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(item.manual_date))}
                    </p>
                  </div>

                  {/* Right: Bank Transaction */}
                  <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Bank Sync</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1 text-primary border-primary/30">
                        {item.bank_category}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {formatINR(item.bank_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.bank_description || item.raw_bank_description}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(item.bank_date))}
                    </p>
                  </div>
                </div>

                {item.match_reasons && item.match_reasons.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {item.match_reasons.join(' · ')}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    Match Confidence: <strong className="text-foreground">{Math.round(parseFloat(String(item.confidence_score)) * 100)}%</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleKeepSeparate(item.id)}
                      disabled={reconcilingId === item.id}
                      className="h-7 text-xs rounded-lg"
                    >
                      {reconcilingId === item.id && reconcileAction === 'separate' ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Keep Separate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleMatch(item.id)}
                      disabled={reconcilingId === item.id}
                      className="h-7 text-xs rounded-lg"
                    >
                      {reconcilingId === item.id && reconcileAction === 'match' ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Match Records
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              aria-label="Search transactions"
              placeholder="Search merchant, description, category, or bank narration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 rounded-xl h-10 text-xs sm:text-sm bg-card"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Clear search text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle Button */}
            <Button
              size="sm"
              variant={isFilterPanelOpen || activeFiltersCount > 0 ? 'secondary' : 'outline'}
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="gap-1.5 rounded-xl h-10 text-xs px-3"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4 ml-1">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Type Filter Tabs */}
            <div className="flex bg-muted/60 p-1 rounded-xl">
              {FILTER_TYPES.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedType(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedType === tab.value
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {isFilterPanelOpen && (
          <Card className="p-4 rounded-2xl border-border/80 bg-card space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Advanced Ledger Filters
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Reset All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Category */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-8 text-xs p-1.5 rounded-lg bg-background border border-border text-foreground outline-hidden"
                >
                  <option value="all">All Categories</option>
                  {ALL_AVAILABLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Provenance / Source</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full h-8 text-xs p-1.5 rounded-lg bg-background border border-border text-foreground outline-hidden"
                >
                  <option value="all">All Sources</option>
                  <option value="MANUAL">Manual Only</option>
                  <option value="BANK_SYNC">Bank Sync Only</option>
                  <option value="RECONCILED">Reconciled Only</option>
                </select>
              </div>

              {/* Amount Range */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Min Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Max Amount (₹)</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              {/* Date Range */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] text-muted-foreground">Active:</span>
            {selectedCategory !== 'all' && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>Category: {selectedCategory}</span>
                <button type="button" onClick={() => setSelectedCategory('all')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {selectedSource !== 'all' && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>Source: {selectedSource}</span>
                <button type="button" onClick={() => setSelectedSource('all')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {minAmount && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>Min: ₹{minAmount}</span>
                <button type="button" onClick={() => setMinAmount('')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {maxAmount && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>Max: ₹{maxAmount}</span>
                <button type="button" onClick={() => setMaxAmount('')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {startDate && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>From: {startDate}</span>
                <button type="button" onClick={() => setStartDate('')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {endDate && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2 gap-1 rounded-full">
                <span>To: {endDate}</span>
                <button type="button" onClick={() => setEndDate('')}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* 3. Bulk Selection Toolbar (When active) */}
      {isSelectionMode && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAll}
              className="h-8 text-xs rounded-xl"
            >
              {selectedIds.size === rawItems.length && rawItems.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-xs font-semibold text-primary">
              {selectedIds.size} of {rawItems.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={selectedIds.size === 0}
              className="h-8 text-xs rounded-xl gap-1.5 shadow-xs"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Change Category</span>
            </Button>
          </div>
        </div>
      )}

      {/* 4. Transactions List */}
      {isLoading ? (
        <div className="py-12">
          <LoadingState message="Loading transactions..." />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load transactions"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      ) : rawItems.length === 0 ? (
        <EmptyState
          title={totalCount === 0 && !searchTerm && activeFiltersCount === 0 ? 'No transactions yet' : 'No matching transactions'}
          description={
            totalCount === 0 && !searchTerm && activeFiltersCount === 0
              ? 'Record your canteen meals, metro fares, or family allowances to start tracking.'
              : 'Try clearing your search term or adjusting filters.'
          }
          actionLabel={totalCount === 0 && !searchTerm && activeFiltersCount === 0 ? 'Add Your First Record' : undefined}
          onAction={totalCount === 0 && !searchTerm && activeFiltersCount === 0 ? handleOpenAdd : undefined}
        />
      ) : (
        <Card className="rounded-2xl border-border/80 overflow-hidden shadow-xs">
          <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Transactions ({rawItems.length}
              {totalCount > rawItems.length ? ` of ${totalCount}` : ''})
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Authoritative Ledger</span>
            </span>
          </div>

          <div className="divide-y divide-border/60">
            {rawItems.map((tx) => {
              const isExpense = tx.transaction_type === 'expense'
              const formattedDate = new Intl.DateTimeFormat('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(tx.transaction_date))

              const isConfirmingDelete = deleteConfirmId === tx.id
              const isSelected = selectedIds.has(tx.id)

              // Compute primary headline: Normalized merchant > Merchant > Description > Category
              const primaryTitle = tx.normalized_merchant || tx.merchant || tx.description || tx.category

              return (
                <div
                  key={tx.id}
                  onClick={() => handleOpenDetail(tx)}
                  className={`p-3.5 sm:p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    {/* Checkbox if selection mode */}
                    {isSelectionMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelect(tx.id)
                        }}
                        aria-label={`Select transaction ${tx.id}`}
                        className="mt-1 text-primary focus:outline-hidden"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    ) : (
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isExpense
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {isExpense ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {primaryTitle}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 bg-background font-medium"
                        >
                          {tx.category}
                        </Badge>
                        <Badge
                          variant={isExpense ? 'outline' : 'secondary'}
                          className="text-[10px] py-0 px-1.5 capitalize"
                        >
                          {tx.payment_method}
                        </Badge>
                        {tx.source === 'RECONCILED' ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-medium"
                          >
                            Reconciled
                          </Badge>
                        ) : tx.source === 'BANK_SYNC' ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-primary border-primary/30 bg-primary/5 font-medium"
                          >
                            Bank Sync
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-muted-foreground border-border/70"
                          >
                            Manual
                          </Badge>
                        )}
                        {tx.is_recurring && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10 font-medium"
                          >
                            {tx.recurring_type === 'SUBSCRIPTION' ? 'Subscription' : 'Recurring'}
                          </Badge>
                        )}
                      </div>

                      {/* Secondary description / narration */}
                      {tx.description && tx.description !== primaryTitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {tx.description}
                        </p>
                      )}
                      {tx.raw_bank_description && (
                        <p
                          className="text-[10px] font-mono text-muted-foreground/80 truncate mt-0.5"
                          title={tx.raw_bank_description}
                        >
                          {tx.raw_bank_description}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formattedDate}</p>
                    </div>
                  </div>

                  {/* Amount and Action Buttons */}
                  <div
                    className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-left sm:text-right">
                      <p
                        className={`text-base font-bold tracking-tight ${
                          isExpense
                            ? 'text-foreground'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isExpense ? `-${formatINR(tx.amount)}` : `+${formatINR(tx.amount)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                            className="h-8 text-xs px-2.5 rounded-lg"
                          >
                            {deletingId === tx.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Confirm'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-8 text-xs px-2 rounded-lg"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(tx)}
                            aria-label={`Edit ${tx.category} transaction`}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground touch-target"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(tx.id)}
                            aria-label={`Delete ${tx.category} transaction`}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive touch-target"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 5. Bulk Category Modal */}
      {isBulkModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setIsBulkModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-5 space-y-4 text-card-foreground animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground">Bulk Change Category</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsBulkModalOpen(false)}
                className="h-7 w-7 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Update {selectedIds.size} selected transaction(s) to a unified category.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">New Category</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-primary outline-hidden"
                >
                  {ALL_AVAILABLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkRememberPreference}
                  onChange={(e) => setBulkRememberPreference(e.target.checked)}
                  className="rounded-sm border-border text-primary focus:ring-primary"
                />
                <span>Remember this category rule for matching merchants</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isBulkUpdating}
                className="h-8 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkCategorySubmit}
                disabled={isBulkUpdating}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                {isBulkUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                Apply Category
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Form Sheet (Add / Edit) */}
      <TransactionFormSheet
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialTransaction={editingTransaction}
      />

      {/* 7. Transaction Detail Sheet */}
      <TransactionDetailSheet
        transaction={detailTransaction}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setDetailTransaction(null)
        }}
        onEdit={(tx) => handleOpenEdit(tx)}
        onDelete={(id) => handleDelete(id)}
      />
    </div>
  )
}
