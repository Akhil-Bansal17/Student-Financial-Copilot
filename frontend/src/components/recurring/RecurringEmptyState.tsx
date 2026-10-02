import { CalendarClock, Sparkles, PlusCircle, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface RecurringEmptyStateProps {
  onDetect: () => void
  isDetecting: boolean
  onAddTransaction?: () => void
}

export function RecurringEmptyState({
  onDetect,
  isDetecting,
  onAddTransaction,
}: RecurringEmptyStateProps) {
  return (
    <Card className="rounded-3xl border border-dashed border-border/80 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5 bg-card/60 backdrop-blur-xs shadow-xs">
      <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
        <CalendarClock className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-bold text-foreground">
          No recurring expenses detected yet
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          FinCopilot automatically detects periodic payments like Netflix, Spotify, mobile recharges, hostel rent, and mess bills once 2 or more occurrences happen with a regular interval.
        </p>
      </div>

      {/* Feature Bullet Points */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs text-muted-foreground pt-2">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Deterministic</span>
          </p>
          <p className="text-[11px] mt-0.5">Zero hallucination — computed strictly from real bank & manual records.</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>Price Tracking</span>
          </p>
          <p className="text-[11px] mt-0.5">Notifies you if your subscription or utility bill changed price.</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-500" />
            <span>Due Forecasts</span>
          </p>
          <p className="text-[11px] mt-0.5">Projects next renewal date so you never get caught with zero balance.</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
        <Button
          onClick={onDetect}
          disabled={isDetecting}
          className="rounded-xl shadow-xs font-semibold text-xs h-10 px-5 gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
          <span>{isDetecting ? 'Detecting Patterns...' : 'Run Pattern Detection'}</span>
        </Button>

        {onAddTransaction && (
          <Button
            variant="outline"
            onClick={onAddTransaction}
            className="rounded-xl font-medium text-xs h-10 px-4 gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Record Expense</span>
          </Button>
        )}
      </div>
    </Card>
  )
}
