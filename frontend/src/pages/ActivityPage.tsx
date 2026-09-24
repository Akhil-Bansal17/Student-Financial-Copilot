import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TransactionFormSheet } from '@/components/transactions/TransactionFormSheet'
import { formatINR } from '@/lib/utils'
import { transactionService } from '@/services/transactionService'
import { queryClient } from '@/lib/queryClient'
import type { Transaction, TransactionType } from '@/types/transaction'

const FILTER_TYPES: { label: string; value: 'all' | 'expense' | 'income' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Expenses', value: 'expense' },
  { label: 'Income', value: 'income' },
]

export function ActivityPage() {
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [limit, setLimit] = useState(20)

  // Sheet states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Deletion state
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Query transactions
  const {
    data: txData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['transactions', selectedType, limit],
    queryFn: () =>
      transactionService.getTransactions({
        transaction_type: selectedType === 'all' ? undefined : (selectedType as TransactionType),
        limit,
        offset: 0,
      }),
  })

  const handleOpenAdd = () => {
    setEditingTransaction(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTransaction(tx)
    setIsFormOpen(true)
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

  const rawItems = txData?.items || []
  const totalCount = txData?.total || 0

  // Filter client-side by search term (description or category)
  const filteredItems = rawItems.filter((tx) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const descMatch = tx.description?.toLowerCase().includes(term)
    const catMatch = tx.category.toLowerCase().includes(term)
    const payMatch = tx.payment_method.toLowerCase().includes(term)
    return descMatch || catMatch || payMatch
  })

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Activity & Transactions
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track student expenditures, allowances, and payments
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleOpenAdd}
          className="gap-1.5 rounded-xl shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add Record</span>
        </Button>
      </div>

      {/* Delete Error Notification */}
      {deleteError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-in fade-in"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* 2. Search and Filter Chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes, canteen, hostel, transit, UPI..."
            className="pl-10 h-11 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter type buttons */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-muted-foreground flex items-center gap-1 pl-1 shrink-0 font-medium">
            <Filter className="h-3.5 w-3.5" />
          </span>
          {FILTER_TYPES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSelectedType(f.value)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-colors touch-target ${
                selectedType === f.value
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Transaction Content */}
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
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={rawItems.length === 0 ? 'No transactions yet' : 'No matching transactions'}
          description={
            rawItems.length === 0
              ? 'Record your canteen meals, metro fares, or family allowances to start tracking.'
              : 'Try clearing your search term or adjusting filters.'
          }
          actionLabel={rawItems.length === 0 ? 'Add Your First Record' : undefined}
          onAction={rawItems.length === 0 ? handleOpenAdd : undefined}
        />
      ) : (
        <Card className="rounded-2xl border-border/80 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Transactions ({filteredItems.length}
              {totalCount > filteredItems.length ? ` of ${totalCount}` : ''})
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Real Ledger</span>
            </span>
          </div>

          <div className="divide-y divide-border/60">
            {filteredItems.map((tx) => {
              const isExpense = tx.transaction_type === 'expense'
              const formattedDate = new Intl.DateTimeFormat('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(tx.transaction_date))

              const isConfirmingDelete = deleteConfirmId === tx.id

              return (
                <div
                  key={tx.id}
                  className="p-3.5 sm:p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3 min-w-0">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {tx.category}
                        </p>
                        <Badge
                          variant={isExpense ? 'outline' : 'secondary'}
                          className="text-[10px] py-0 px-1.5 capitalize"
                        >
                          {tx.payment_method}
                        </Badge>
                      </div>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {tx.description}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formattedDate}</p>
                    </div>
                  </div>

                  {/* Amount and Action Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
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

          {/* Load More Pagination */}
          {totalCount > rawItems.length && (
            <div className="p-3 text-center border-t border-border/60 bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((prev) => prev + 20)}
                className="text-xs rounded-xl"
              >
                Load More Transactions ({totalCount - rawItems.length} remaining)
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Transaction Modal / Sheet */}
      <TransactionFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialTransaction={editingTransaction}
      />
    </div>
  )
}
