import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Loader2,
  Plus,
  History,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Goal } from '@/types/goal'
import { goalService, goalKeys } from '@/services/goalService'
import { queryClient } from '@/lib/queryClient'
import { ApiError } from '@/services/apiClient'
import { formatINR } from '@/lib/utils'

export interface ContributeSheetProps {
  isOpen: boolean
  onClose: () => void
  goal: Goal | null
  onSuccess?: () => void
}

interface FormContentProps {
  goal: Goal
  onClose: () => void
  onSuccess?: () => void
}

function ContributeFormContent({ goal, onClose, onSuccess }: FormContentProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingContribId, setDeletingContribId] = useState<number | null>(null)

  // Fetch contributions history
  const { data: contributions, isLoading: isHistoryLoading } = useQuery({
    queryKey: goalKeys.contributions(goal.id),
    queryFn: () => goalService.getGoalContributions(goal.id),
    enabled: Boolean(goal.id),
  })

  const remainingNum = Math.max(0, parseFloat(goal.remaining_amount))
  const savedNum = parseFloat(goal.current_amount)
  const targetNum = parseFloat(goal.target_amount)

  const quickAmounts = [500, 1000, 2000, 5000].filter(
    (amt) => amt <= remainingNum
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanAmount = amount.trim()
    if (!cleanAmount) {
      setErrorMessage('Please enter an amount to contribute.')
      return
    }

    const num = parseFloat(cleanAmount)
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Contribution amount must be greater than ₹0.')
      return
    }

    if (num > remainingNum) {
      setErrorMessage(
        `Contribution of ${formatINR(num)} exceeds remaining target of ${formatINR(remainingNum)}.`
      )
      return
    }

    try {
      setIsSubmitting(true)
      await goalService.contributeToGoal(goal.id, {
        amount: num.toFixed(2),
        note: note.trim() || null,
      })

      await queryClient.invalidateQueries({ queryKey: ['goals'] })
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to add contribution.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContribution = async (contribId: number) => {
    try {
      setDeletingContribId(contribId)
      await goalService.deleteGoalContribution(goal.id, contribId)
      await queryClient.invalidateQueries({ queryKey: ['goals'] })
      onSuccess?.()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      }
    } finally {
      setDeletingContribId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Target Progress Summary Box */}
      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Goal Status</span>
          <span className="font-bold text-foreground">{goal.progress_percentage}% saved</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
          <div className="p-2 rounded-xl bg-card border border-border/40">
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Saved</span>
            <span className="font-bold text-foreground block truncate">{formatINR(savedNum)}</span>
          </div>
          <div className="p-2 rounded-xl bg-card border border-border/40">
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Target</span>
            <span className="font-bold text-foreground block truncate">{formatINR(targetNum)}</span>
          </div>
          <div className="p-2 rounded-xl bg-card border border-border/40">
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Remaining</span>
            <span className="font-bold text-primary block truncate">{formatINR(remainingNum)}</span>
          </div>
        </div>
      </div>

      {/* Contribution Form */}
      {remainingNum > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Amount input */}
          <div className="space-y-1.5">
            <label
              htmlFor="contrib-amount-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Add Money (₹ INR) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-lg font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id="contrib-amount-input"
                type="number"
                step="0.01"
                min="1"
                max={remainingNum}
                placeholder="e.g. 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-base font-semibold h-11 rounded-xl"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Quick Amount Suggestion Chips */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground font-medium">Quick Select:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border/80 hover:bg-muted/60 transition-colors text-foreground touch-target"
                >
                  +{formatINR(amt, 0)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(remainingNum.toFixed(2))}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors touch-target"
              >
                Full Remaining ({formatINR(remainingNum, 0)})
              </button>
            </div>
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label
              htmlFor="contrib-note-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Allocation Note (Optional)
            </label>
            <Input
              id="contrib-note-input"
              type="text"
              placeholder="e.g. Pocket money, Birthday gift, Project bonus"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
              className="h-10 rounded-xl"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl font-semibold gap-2 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Adding Money...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Add {amount ? formatINR(amount) : 'Savings'}</span>
              </>
            )}
          </Button>
        </form>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 text-center space-y-1.5">
          <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-sm font-bold">Goal Fully Funded!</h4>
          <p className="text-xs text-muted-foreground">
            Congratulations! You have reached 100% of your target amount.
          </p>
        </div>
      )}

      {/* Savings Contribution History Section */}
      <div className="pt-2 border-t border-border/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            <span>Savings History</span>
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {contributions?.length || 0} contribution{contributions?.length === 1 ? '' : 's'}
          </span>
        </div>

        {isHistoryLoading ? (
          <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Loading history...</span>
          </div>
        ) : !contributions || contributions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No contributions made yet. Add your first savings above.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {contributions.map((c) => {
              const formattedDate = new Intl.DateTimeFormat('en-IN', {
                day: 'numeric',
                month: 'short',
              }).format(new Date(c.created_at))

              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/50 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(c.amount)}
                    </span>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.note || 'Savings allocation'} · {formattedDate}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteContribution(c.id)}
                    disabled={deletingContribId === c.id}
                    aria-label={`Remove contribution of ${formatINR(c.amount)}`}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive shrink-0 touch-target"
                  >
                    {deletingContribId === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function ContributeSheet({
  isOpen,
  onClose,
  goal,
  onSuccess,
}: ContributeSheetProps) {
  if (!goal) return null

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Money to ${goal.name}`}
      description="Allocate student savings toward your target milestone"
      position="bottom"
    >
      {isOpen && (
        <ContributeFormContent
          key={`contrib-${goal.id}-${goal.current_amount}`}
          goal={goal}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Sheet>
  )
}
