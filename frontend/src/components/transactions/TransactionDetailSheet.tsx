import { useState, useEffect } from 'react'
import {
  X,
  Edit2,
  Trash2,
  Calendar,
  CreditCard,
  Building2,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Transaction,
} from '@/types/transaction'
import { transactionService } from '@/services/transactionService'

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onEdit: (tx: Transaction) => void
  onDelete: (id: number) => void
}

export function TransactionDetailSheet({
  transaction,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailSheetProps) {
  const queryClient = useQueryClient()
  const [copiedId, setCopiedId] = useState(false)
  const [isChangingCategory, setIsChangingCategory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [rememberPreference, setRememberPreference] = useState(true)
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])


  if (!isOpen || !transaction) return null

  const isExpense = transaction.transaction_type === 'expense'
  const availableCategories = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(transaction.transaction_date))

  const handleCopyExternalId = () => {
    if (transaction.external_transaction_id) {
      navigator.clipboard.writeText(transaction.external_transaction_id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleQuickCategorySave = async () => {
    if (!selectedCategory || selectedCategory === transaction.category) {
      setIsChangingCategory(false)
      return
    }

    try {
      setIsUpdatingCategory(true)
      setUpdateError(null)
      await transactionService.updateTransaction(transaction.id, {
        category: selectedCategory,
        remember_merchant_preference: rememberPreference,
      })

      // Invalidate relevant queries to immediately refresh UI, budgets, analytics
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['financial-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['analytics'] })
      await queryClient.invalidateQueries({ queryKey: ['budgets'] })
      await queryClient.invalidateQueries({ queryKey: ['insights'] })
      await queryClient.invalidateQueries({ queryKey: ['merchant-preferences'] })

      setIsChangingCategory(false)
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setIsUpdatingCategory(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-detail-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/80 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4 text-card-foreground animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                isExpense
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}
            >
              {isExpense ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="tx-detail-title" className="text-base font-bold text-foreground">
                Transaction Details
              </h2>
              <p className="text-[11px] text-muted-foreground capitalize">
                {transaction.transaction_type} • ID #{transaction.id}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close transaction details"
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Amount Hero */}
        <div className="text-center py-2 bg-muted/20 rounded-2xl border border-border/50">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Authoritative Amount
          </span>
          <p
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5 ${
              isExpense ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isExpense ? `-${formatINR(transaction.amount)}` : `+${formatINR(transaction.amount)}`}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <Badge variant="outline" className="text-[10px] py-0 px-2 uppercase tracking-wider">
              {transaction.status || 'POSTED'}
            </Badge>
            {((transaction.source || '').toUpperCase() === 'RECONCILED') ? (
              <Badge variant="outline" className="text-[10px] py-0 px-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                Reconciled with Bank
              </Badge>
            ) : ((transaction.source || '').toUpperCase() === 'BANK_SYNC') ? (
              <Badge variant="outline" className="text-[10px] py-0 px-2 text-primary border-primary/30 bg-primary/5">
                Bank Sync
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] py-0 px-2 text-muted-foreground">
                Manual Entry
              </Badge>
            )}
          </div>
        </div>

        {/* Error notification */}
        {updateError && (
          <div role="alert" className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{updateError}</span>
          </div>
        )}

        {/* Intelligence & Merchant Card */}
        <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Counterparty / Merchant
            </span>
            {transaction.normalized_merchant && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold text-primary">
                Normalized
              </Badge>
            )}
          </div>
          <p className="text-base font-bold text-foreground">
            {transaction.normalized_merchant || transaction.merchant || transaction.description || 'Unknown Counterparty'}
          </p>
          {transaction.raw_bank_description && (
            <div className="mt-1 pt-1.5 border-t border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                Original Bank Narration
              </span>
              <p className="text-xs font-mono text-muted-foreground/90 break-all bg-background/60 p-2 rounded-lg mt-0.5 border border-border/40">
                {transaction.raw_bank_description}
              </p>
            </div>
          )}
        </div>

        {/* Detailed Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Category Section */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Category
              </span>
              {!isChangingCategory && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(transaction.category)
                    setIsChangingCategory(true)
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Quick Change
                </button>
              )}
            </div>

            {!isChangingCategory ? (
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs py-0.5 px-2 bg-background font-semibold">
                  {transaction.category}
                </Badge>
                {transaction.category_confidence && (
                  <span className="text-[10px] text-muted-foreground">
                    Confidence: <strong className="text-foreground">{transaction.category_confidence}</strong>
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-foreground focus:ring-2 focus:ring-primary outline-hidden"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {transaction.normalized_merchant && (
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberPreference}
                      onChange={(e) => setRememberPreference(e.target.checked)}
                      className="rounded-sm border-border text-primary focus:ring-primary"
                    />
                    <span>Always categorize <strong>{transaction.normalized_merchant}</strong> as this</span>
                  </label>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsChangingCategory(false)}
                    disabled={isUpdatingCategory}
                    className="h-7 text-xs px-2.5 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleQuickCategorySave}
                    disabled={isUpdatingCategory}
                    className="h-7 text-xs px-3 rounded-lg gap-1"
                  >
                    {isUpdatingCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Date & Time
            </span>
            <p className="font-semibold text-foreground truncate">{formattedDate}</p>
          </div>

          {/* Payment Method */}
          <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Payment Method
            </span>
            <p className="font-semibold text-foreground truncate">{transaction.payment_method}</p>
          </div>

          {/* Account / Institution */}
          {transaction.provider && (
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1 col-span-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Financial Institution
              </span>
              <p className="font-semibold text-foreground truncate capitalize">
                {transaction.provider.replace('_', ' ')}
                {transaction.account_id ? ` (Account #${transaction.account_id})` : ''}
              </p>
            </div>
          )}

          {/* External Transaction ID (Safe view) */}
          {transaction.external_transaction_id && (
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">External Bank Reference</span>
                <button
                  type="button"
                  onClick={handleCopyExternalId}
                  className="text-[10px] text-primary flex items-center gap-1 hover:underline"
                >
                  {copiedId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedId ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="font-mono text-[11px] text-foreground truncate">
                {transaction.external_transaction_id}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-2 w-full justify-end animate-in fade-in">
              <span className="text-xs text-destructive font-medium">Delete record?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  onDelete(transaction.id)
                  onClose()
                }}
                className="h-8 text-xs rounded-xl"
              >
                Yes, Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsConfirmingDelete(false)}
                className="h-8 text-xs rounded-xl"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIsConfirmingDelete(true)}
                className="gap-1.5 rounded-xl h-9 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose()
                    onEdit(transaction)
                  }}
                  className="gap-1.5 rounded-xl h-9 text-xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Full Details</span>
                </Button>
                <Button
                  size="sm"
                  onClick={onClose}
                  className="rounded-xl h-9 text-xs px-4"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
