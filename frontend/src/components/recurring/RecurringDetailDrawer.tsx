import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  EyeOff,
  Loader2,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatINR } from '@/lib/utils'
import { recurringService, recurringKeys } from '@/services/recurringService'
import type {
  RecurringExpense,
  RecurringType,
  RecurringFrequency,
  RecurringStatus,
} from '@/types/recurring'

interface RecurringDetailDrawerProps {
  expense: RecurringExpense | null
  isOpen: boolean
  onClose: () => void
}

export function RecurringDetailDrawer({
  expense,
  isOpen,
  onClose,
}: RecurringDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(expense?.notes || '')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  // Fetch full details (including transaction history and preference)
  const {
    data: detail,
    isLoading,
  } = useQuery({
    queryKey: recurringKeys.detail(expense?.id || 0),
    queryFn: () => recurringService.getRecurringDetail(expense!.id),
    enabled: isOpen && !!expense?.id,
  })

  // Listen for Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const invalidateRecurring = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: recurringKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['forecast'] }),
    ])
  }

  // Mutation: Update type / status / frequency / notes
  const updateMutation = useMutation({
    mutationFn: (data: {
      recurring_type?: RecurringType
      status?: RecurringStatus
      frequency?: RecurringFrequency
      notes?: string
    }) => recurringService.updateRecurringExpense(expense!.id, data),
    onSuccess: async () => {
      setActionFeedback('Recurring expense updated successfully.')
      await invalidateRecurring()
      setTimeout(() => setActionFeedback(null), 3000)
    },
    onError: (err: unknown) => {
      setActionFeedback(err instanceof Error ? err.message : 'Update failed.')
    },
  })

  // Mutation: Ignore (not recurring)
  const ignoreMutation = useMutation({
    mutationFn: () => recurringService.ignoreRecurringExpense(expense!.id),
    onSuccess: async () => {
      setActionFeedback('Marked as not recurring. Future payments will be ignored.')
      await invalidateRecurring()
      setTimeout(() => {
        setActionFeedback(null)
        onClose()
      }, 1500)
    },
    onError: (err: unknown) => {
      setActionFeedback(err instanceof Error ? err.message : 'Action failed.')
    },
  })



  if (!isOpen || !expense) return null

  const liveExpense = detail?.recurring || expense
  const historyTxs = detail?.history || []

  const formattedLastDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(liveExpense.last_occurrence_date))

  const formattedNextDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(liveExpense.next_expected_date))

  const amountChangeNum = Number(liveExpense.amount_change || 0)
  const amountChangePercent = Number(liveExpense.amount_change_percentage || 0)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card border-l border-border/80 h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${liveExpense.merchant}`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                {liveExpense.merchant}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{liveExpense.category}</span>
                <span className="text-border">·</span>
                <span className="capitalize">{liveExpense.frequency.toLowerCase()} cadence</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground touch-target"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-5 flex-1">
          {/* Key Hero Metrics */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment Breakdown
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-primary border-primary/30 font-semibold"
              >
                {liveExpense.confidence} Confidence Detection
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                  Latest Amount
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-foreground">
                  {formatINR(liveExpense.latest_amount)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                  Average Amount
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-muted-foreground">
                  {formatINR(liveExpense.average_amount)}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-medium">
                  Occurrences
                </span>
                <span className="text-base sm:text-lg font-bold text-foreground">
                  {liveExpense.occurrence_count} times
                </span>
              </div>
            </div>

            {/* Price Change Notification if detected */}
            {Math.abs(amountChangeNum) > 0.01 && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                  amountChangeNum > 0
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}
              >
                {amountChangeNum > 0 ? (
                  <TrendingUp className="h-4 w-4 shrink-0" />
                ) : (
                  <TrendingDown className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {amountChangeNum > 0 ? 'Price increased' : 'Price decreased'} by{' '}
                  <strong>{formatINR(Math.abs(amountChangeNum))}</strong> (
                  {amountChangePercent > 0 ? `+${amountChangePercent.toFixed(1)}%` : `${amountChangePercent.toFixed(1)}%`}){' '}
                  compared to the previous charge of {formatINR(liveExpense.previous_amount || 0)}.
                </span>
              </div>
            )}
          </div>

          {/* Schedule Projections */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-2.5 text-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Projection & Schedule
            </span>
            <div className="divide-y divide-border/40">
              <div className="py-2 flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Last Detected Charge</span>
                </span>
                <span className="font-semibold text-foreground">{formattedLastDate}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Next Expected Payment</span>
                </span>
                <span className="font-semibold text-foreground">{formattedNextDate}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-muted-foreground">Amount Range</span>
                <span className="font-mono text-muted-foreground">
                  {formatINR(liveExpense.min_amount)} – {formatINR(liveExpense.max_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Classification & Status Management */}
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Classification & Controls
            </span>

            {/* Classification Quick Buttons */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                variant={liveExpense.recurring_type === 'SUBSCRIPTION' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updateMutation.mutate({ recurring_type: 'SUBSCRIPTION' })
                }
                disabled={updateMutation.isPending}
                className="h-9 rounded-xl font-medium justify-start gap-2"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Subscription</span>
              </Button>

              <Button
                variant={liveExpense.recurring_type === 'RECURRING_BILL' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  updateMutation.mutate({ recurring_type: 'RECURRING_BILL' })
                }
                disabled={updateMutation.isPending}
                className="h-9 rounded-xl font-medium justify-start gap-2"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Recurring Bill</span>
              </Button>
            </div>

            {/* Pause / Resume Button */}
            <div className="flex items-center gap-2">
              {liveExpense.status === 'PAUSED' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ status: 'ACTIVE' })}
                  disabled={updateMutation.isPending}
                  className="rounded-xl text-xs gap-1.5 h-9 flex-1"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Resume Tracking</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ status: 'PAUSED' })}
                  disabled={updateMutation.isPending}
                  className="rounded-xl text-xs gap-1.5 h-9 flex-1"
                >
                  <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span>Pause Tracking</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => ignoreMutation.mutate()}
                disabled={ignoreMutation.isPending}
                className="rounded-xl text-xs gap-1.5 h-9 flex-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>Not Recurring (Ignore)</span>
              </Button>
            </div>
          </div>

          {/* Student Notes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              <span>Student Notes</span>
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Shared with roommate Rahul, ends in December..."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-muted/40 border border-border/60 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMutation.mutate({ notes })}
                disabled={updateMutation.isPending || notes === (liveExpense.notes || '')}
                className="text-xs rounded-xl h-8 px-3"
              >
                Save
              </Button>
            </div>
          </div>

          {/* Past Payments History */}
          <div className="space-y-2.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment History ({historyTxs.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Authoritative transaction ledger
              </span>
            </div>

            {isLoading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyTxs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 italic">
                No past transactions recorded for this merchant.
              </p>
            ) : (
              <Card className="rounded-xl border-border/60 overflow-hidden divide-y divide-border/40">
                {historyTxs.map((tx) => {
                  const txDate = new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(tx.transaction_date))

                  return (
                    <div
                      key={tx.id}
                      className="p-3 text-xs flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">
                          {tx.description || tx.merchant || liveExpense.merchant}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {txDate} · {tx.payment_method} · {tx.source || 'MANUAL'}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-foreground">
                        {formatINR(tx.amount)}
                      </span>
                    </div>
                  )
                })}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
