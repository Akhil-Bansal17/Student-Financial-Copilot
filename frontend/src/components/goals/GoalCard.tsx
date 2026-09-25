import { useState } from 'react'
import {
  Target,
  Edit2,
  Trash2,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { Goal } from '@/types/goal'

interface GoalCardProps {
  goal: Goal
  onEdit: () => void
  onDelete: (id: number) => Promise<void>
  onContribute: () => void
  isDeleting?: boolean
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
  isDeleting = false,
}: GoalCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const progressPercent = Math.min(100, Math.max(0, parseFloat(goal.progress_percentage || '0')))

  let progressBg = 'bg-primary'
  let iconBg = 'bg-primary/10 text-primary'

  if (goal.status === 'completed') {
    progressBg = 'bg-emerald-500'
    iconBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  } else if (goal.status === 'overdue') {
    progressBg = 'bg-rose-500'
    iconBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  }

  const handleDelete = async () => {
    await onDelete(goal.id)
    setShowConfirmDelete(false)
  }

  const formatTargetDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr + 'T00:00:00')
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const isCompleted = goal.status === 'completed'

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs hover:shadow-card transition-all bg-card overflow-hidden flex flex-col justify-between">
      <CardContent className="p-5 space-y-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-3 min-w-0">
            <div className={`h-10 w-10 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground leading-snug truncate" title={goal.name}>
                {goal.name}
              </h3>
              {goal.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5" title={goal.description}>
                  {goal.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {showConfirmDelete ? (
              <div className="flex items-center space-x-1 animate-in fade-in">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-7 px-2 text-xs rounded-lg"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="h-7 px-1.5 text-xs rounded-lg text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label={`Edit ${goal.name}`}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground touch-target"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(true)}
                  aria-label={`Delete ${goal.name}`}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive touch-target"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Status and Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {goal.status === 'completed' && (
                <Badge variant="success" className="text-[11px] font-semibold px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3 mr-1 inline shrink-0" />
                  Completed
                </Badge>
              )}
              {goal.status === 'overdue' && (
                <Badge variant="destructive" className="text-[11px] font-semibold px-2 py-0.5">
                  <AlertTriangle className="h-3 w-3 mr-1 inline shrink-0" />
                  Overdue
                </Badge>
              )}
              {goal.status === 'active' && (
                <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                  In Progress
                </Badge>
              )}
            </div>
            <span className="font-bold text-sm text-foreground">{progressPercent}%</span>
          </div>

          {/* Progress Track */}
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${progressBg}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">{formatINR(goal.current_amount)}</span>
            <span className="text-muted-foreground">Target: {formatINR(goal.target_amount)}</span>
          </div>
        </div>

        {/* Detail Chips */}
        <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Remaining</span>
            <span
              className={`font-semibold truncate block ${
                isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
              }`}
            >
              {isCompleted ? 'Target Reached' : formatINR(goal.remaining_amount)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Target Date</span>
            <span className="font-medium text-foreground truncate flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              {goal.target_date ? formatTargetDate(goal.target_date) : 'No deadline'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-1">
          {isCompleted ? (
            <Button
              disabled
              variant="outline"
              className="w-full h-9 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Goal Reached!
            </Button>
          ) : (
            <Button
              onClick={onContribute}
              className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5 shadow-xs"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add Money</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
