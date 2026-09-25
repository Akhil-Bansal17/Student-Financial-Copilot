import { useState } from 'react'
import {
  Utensils,
  Train,
  Home as HomeIcon,
  BookOpen,
  Tv,
  Sparkles,
  CreditCard,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Shield,
  ShoppingBag,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { BudgetCategorySummary } from '@/types/budget'

interface CategoryBudgetCardProps {
  summary: BudgetCategorySummary
  onEdit: () => void
  onDelete: (id: number) => Promise<void>
  isDeleting?: boolean
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const cat = category.toLowerCase()
  if (cat.includes('food')) return <Utensils className={className} />
  if (cat.includes('transport') || cat.includes('travel') || cat.includes('commute')) return <Train className={className} />
  if (cat.includes('hostel') || cat.includes('rent') || cat.includes('accommodation')) return <HomeIcon className={className} />
  if (cat.includes('education') || cat.includes('books') || cat.includes('course')) return <BookOpen className={className} />
  if (cat.includes('bills') || cat.includes('utilities') || cat.includes('recharge')) return <Tv className={className} />
  if (cat.includes('entertainment') || cat.includes('movies') || cat.includes('fun')) return <Sparkles className={className} />
  if (cat.includes('shopping') || cat.includes('clothes')) return <ShoppingBag className={className} />
  if (cat.includes('health') || cat.includes('medical')) return <Shield className={className} />
  return <CreditCard className={className} />
}

export function CategoryBudgetCard({
  summary,
  onEdit,
  onDelete,
  isDeleting = false,
}: CategoryBudgetCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const utilNum = parseFloat(summary.utilization || '0')
  const progressPercent = Math.min(Math.max(utilNum, 0), 100)

  let progressBg = 'bg-primary'

  if (summary.over_budget) {
    progressBg = 'bg-rose-500'
  } else if (utilNum >= 80) {
    progressBg = 'bg-amber-500'
  } else {
    progressBg = 'bg-emerald-500'
  }

  const handleDelete = async () => {
    await onDelete(summary.id)
    setShowConfirmDelete(false)
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs hover:shadow-card transition-all bg-card overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CategoryIcon category={summary.category} className="h-4 w-4" />
            </div>
            <div className="truncate">
              <h4 className="text-sm font-bold text-foreground truncate">{summary.category}</h4>
              <p className="text-[11px] text-muted-foreground">{summary.utilization}% used</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {summary.over_budget ? (
              <Badge variant="destructive" className="text-[11px] font-semibold px-2 py-0.5">
                <AlertTriangle className="h-3 w-3 mr-1 inline shrink-0" />
                Over Budget
              </Badge>
            ) : utilNum >= 80 ? (
              <Badge variant="warning" className="text-[11px] font-semibold px-2 py-0.5">
                Near Limit
              </Badge>
            ) : null}

            {/* Actions */}
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
                  aria-label={`Edit ${summary.category} budget`}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground touch-target"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(true)}
                  aria-label={`Delete ${summary.category} budget`}
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive touch-target"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Metrics */}
        <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-muted/30 border border-border/40 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Budget</span>
            <span className="font-semibold text-foreground truncate block">{formatINR(summary.budget)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Spent</span>
            <span className="font-semibold text-foreground truncate block">{formatINR(summary.spent)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">Remaining</span>
            <span
              className={`font-semibold truncate block ${
                summary.over_budget
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatINR(summary.remaining)}
            </span>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${progressBg}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
