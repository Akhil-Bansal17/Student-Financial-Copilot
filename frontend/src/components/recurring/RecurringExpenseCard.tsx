import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Tv,
  Receipt,
  Utensils,
  Train,
  Home as HomeIcon,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import type { RecurringExpense } from '@/types/recurring'

interface RecurringExpenseCardProps {
  expense: RecurringExpense
  onClick: () => void
}

function MerchantCategoryIcon({ category, className }: { category: string; className?: string }) {
  const cat = category.toLowerCase()
  if (cat.includes('food')) return <Utensils className={className} />
  if (cat.includes('transport') || cat.includes('travel') || cat.includes('commute')) return <Train className={className} />
  if (cat.includes('hostel') || cat.includes('rent')) return <HomeIcon className={className} />
  if (cat.includes('education') || cat.includes('books')) return <BookOpen className={className} />
  if (cat.includes('bills') || cat.includes('recharge') || cat.includes('subscription')) return <Tv className={className} />
  if (cat.includes('fun') || cat.includes('entertainment')) return <Sparkles className={className} />
  return <Receipt className={className} />
}

function getRelativeDueInfo(nextDateStr: string): {
  label: string
  isOverdue: boolean
  isSoon: boolean
} {
  const nextDate = new Date(nextDateStr)
  const now = new Date()
  // Strip time for clean day comparison
  const d1 = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate())
  const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays)
    return {
      label: daysAgo === 1 ? '1 day overdue' : `${daysAgo} days overdue`,
      isOverdue: true,
      isSoon: false,
    }
  }
  if (diffDays === 0) {
    return { label: 'Due today', isOverdue: false, isSoon: true }
  }
  if (diffDays === 1) {
    return { label: 'Due tomorrow', isOverdue: false, isSoon: true }
  }
  if (diffDays <= 7) {
    return { label: `Due in ${diffDays} days`, isOverdue: false, isSoon: true }
  }
  return { label: `Due in ${diffDays} days`, isOverdue: false, isSoon: false }
}

export function RecurringExpenseCard({ expense, onClick }: RecurringExpenseCardProps) {
  const dueInfo = getRelativeDueInfo(expense.next_expected_date)

  const formattedNextDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(expense.next_expected_date))

  const amountChangeNum = Number(expense.amount_change || 0)
  const amountChangePercent = Number(expense.amount_change_percentage || 0)
  const hasPriceChange = Math.abs(amountChangeNum) > 0.01

  const isSubscription = expense.recurring_type === 'SUBSCRIPTION'
  const isBill = expense.recurring_type === 'RECURRING_BILL'

  return (
    <Card
      onClick={onClick}
      className={`rounded-2xl border transition-all cursor-pointer p-4 bg-card hover:bg-muted/30 shadow-xs hover:shadow-card group ${
        expense.status === 'OVERDUE_EXPECTED'
          ? 'border-amber-500/40 bg-amber-500/5'
          : expense.status === 'POSSIBLY_ENDED'
          ? 'border-dashed border-border/80 opacity-75'
          : 'border-border/80 hover:border-primary/40'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Side: Icon & Details */}
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
              isSubscription
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                : isBill
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                : 'bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            <MerchantCategoryIcon category={expense.category} className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {expense.merchant}
              </h3>

              {/* Recurring Type Badge */}
              <Badge
                variant="outline"
                className={`text-[10px] py-0 px-2 font-semibold ${
                  isSubscription
                    ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10'
                    : isBill
                    ? 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10'
                    : 'text-muted-foreground border-border/70'
                }`}
              >
                {isSubscription ? 'Subscription' : isBill ? 'Bill' : 'Recurring'}
              </Badge>

              {/* Frequency Badge */}
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 capitalize font-medium">
                {expense.frequency.toLowerCase()}
              </Badge>

              {/* Variable Indicator */}
              {expense.is_variable_amount && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground border-dashed">
                  Variable
                </Badge>
              )}

              {/* Status Badge if not standard Active */}
              {expense.status === 'OVERDUE_EXPECTED' && (
                <Badge variant="warning" className="text-[10px] py-0 px-1.5 gap-1 font-semibold">
                  <Clock className="h-2.5 w-2.5" />
                  <span>Expected / Overdue</span>
                </Badge>
              )}
              {expense.status === 'POSSIBLY_ENDED' && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground border-dashed">
                  Possibly Ended
                </Badge>
              )}
              {expense.status === 'PAUSED' && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-amber-600 border-amber-500/30">
                  Paused
                </Badge>
              )}
            </div>

            {/* Next Expected Renewal / Due Date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Next: {formattedNextDate}</span>
              </span>
              <span className="text-border">·</span>
              <span
                className={`font-medium ${
                  dueInfo.isOverdue
                    ? 'text-rose-600 dark:text-rose-400'
                    : dueInfo.isSoon
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
                }`}
              >
                {dueInfo.label}
              </span>
              <span className="text-border">·</span>
              <span className="text-[11px]">{expense.occurrence_count} past payments</span>
            </div>
          </div>
        </div>

        {/* Right Side: Amounts, Price Change Badge & Chevron */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <div className="text-left sm:text-right space-y-0.5">
            <div className="flex items-baseline sm:justify-end gap-1.5">
              <span className="text-base sm:text-lg font-bold tracking-tight text-foreground font-mono">
                {formatINR(expense.latest_amount)}
              </span>
              <span className="text-xs text-muted-foreground">/{expense.frequency === 'YEARLY' ? 'yr' : 'mo'}</span>
            </div>

            {/* Price Change Badges */}
            {hasPriceChange && (
              <div className="flex items-center sm:justify-end gap-1">
                {amountChangeNum > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 font-semibold"
                  >
                    <TrendingUp className="h-3 w-3" />
                    <span>+{formatINR(amountChangeNum)} (+{amountChangePercent.toFixed(1)}%)</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold"
                  >
                    <TrendingDown className="h-3 w-3" />
                    <span>-{formatINR(Math.abs(amountChangeNum))} ({amountChangePercent.toFixed(1)}%)</span>
                  </Badge>
                )}
              </div>
            )}

            {/* Average Spend if variable or fixed */}
            {expense.is_variable_amount && (
              <p className="text-[11px] text-muted-foreground">
                avg {formatINR(expense.average_amount)}
              </p>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:block" />
        </div>
      </div>
    </Card>
  )
}
