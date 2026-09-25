import { useState } from 'react'
import {
  Wallet,
  AlertTriangle,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'

interface OverallBudgetCardProps {
  overallBudget: string | null
  overallBudgetId: number | null
  overallSpending: string
  overallRemaining: string | null
  overallUtilization: string | null
  overallOverBudget: boolean
  onEdit: () => void
  onDelete: (id: number) => Promise<void>
  onSetBudget: () => void
  isDeleting?: boolean
}

export function OverallBudgetCard({
  overallBudget,
  overallBudgetId,
  overallSpending,
  overallRemaining,
  overallUtilization,
  overallOverBudget,
  onEdit,
  onDelete,
  onSetBudget,
  isDeleting = false,
}: OverallBudgetCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  // Empty state: no overall budget configured for this month
  if (!overallBudget || overallBudgetId === null) {
    return (
      <Card className="rounded-2xl border-dashed border-2 border-border/80 p-5 bg-card/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                No Overall Budget Set
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current month's total spending is{' '}
                <span className="font-semibold text-foreground">
                  {formatINR(overallSpending)}
                </span>
                . Set a monthly limit to track your allowance.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onSetBudget}
            className="rounded-xl gap-1.5 shadow-xs w-full sm:w-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Set Monthly Budget</span>
          </Button>
        </div>
      </Card>
    )
  }

  const utilNum = parseFloat(overallUtilization || '0')
  const progressPercent = Math.min(Math.max(utilNum, 0), 100)

  // Badge and progress styling
  let badgeVariant: 'success' | 'warning' | 'destructive' = 'success'
  let badgeLabel = 'On Track'
  let progressBg = 'bg-emerald-500'

  if (overallOverBudget) {
    badgeVariant = 'destructive'
    badgeLabel = 'Over Budget'
    progressBg = 'bg-rose-500'
  } else if (utilNum >= 80) {
    badgeVariant = 'warning'
    badgeLabel = `${utilNum}% Used`
    progressBg = 'bg-amber-500'
  } else {
    badgeLabel = `${utilNum}% Used`
  }

  const handleDelete = async () => {
    if (overallBudgetId) {
      await onDelete(overallBudgetId)
      setShowConfirmDelete(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-card bg-card overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Budget
              </span>
              <h2 className="text-lg font-bold text-foreground">Overall Spending Limit</h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant={badgeVariant} className="text-xs font-semibold px-2.5 py-0.5">
              {overallOverBudget && <AlertTriangle className="h-3 w-3 mr-1 inline shrink-0" />}
              {!overallOverBudget && utilNum < 80 && <CheckCircle2 className="h-3 w-3 mr-1 inline shrink-0" />}
              {badgeLabel}
            </Badge>

            {/* Action buttons */}
            {showConfirmDelete ? (
              <div className="flex items-center space-x-1.5 animate-in fade-in">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-8 px-2.5 text-xs rounded-lg"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="h-8 px-2 text-xs rounded-lg text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label="Edit overall budget"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground touch-target"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(true)}
                  aria-label="Delete overall budget"
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive touch-target"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Metric Breakdown */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3.5 rounded-xl bg-muted/30 border border-border/50">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Budget
            </p>
            <p className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
              {formatINR(overallBudget)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Spent
            </p>
            <p className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
              {formatINR(overallSpending)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Remaining
            </p>
            <p
              className={`text-sm sm:text-base font-bold truncate mt-0.5 ${
                overallOverBudget
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatINR(overallRemaining ?? '0')}
            </p>
          </div>
        </div>

        {/* Progress Bar & Details */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Budget Utilization</span>
            <span className="font-bold text-foreground">{overallUtilization}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${progressBg}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
