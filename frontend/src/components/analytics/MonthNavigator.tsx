import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MonthNavigatorProps {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  disabled?: boolean
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function MonthNavigator({
  year,
  month,
  onChange,
  disabled = false,
}: MonthNavigatorProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed

  const isCurrentMonth = year === currentYear && month === currentMonth
  const isFutureOrCurrent =
    year > currentYear || (year === currentYear && month >= currentMonth)

  const handlePrev = () => {
    if (month === 1) {
      onChange(year - 1, 12)
    } else {
      onChange(year, month - 1)
    }
  }

  const handleNext = () => {
    if (isFutureOrCurrent) return
    if (month === 12) {
      onChange(year + 1, 1)
    } else {
      onChange(year, month + 1)
    }
  }

  const handleResetToCurrent = () => {
    onChange(currentYear, currentMonth)
  }

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-2xl bg-card border border-border/80 shadow-xs">
      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={disabled}
          aria-label="Previous month"
          className="h-9 w-9 p-0 rounded-xl touch-target shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="px-2 sm:px-3 text-center min-w-[120px] sm:min-w-[150px]">
          <span className="text-sm sm:text-base font-bold tracking-tight text-foreground select-none">
            {monthLabel}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={disabled || isFutureOrCurrent}
          aria-label="Next month"
          className="h-9 w-9 p-0 rounded-xl touch-target shrink-0 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {!isCurrentMonth ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToCurrent}
            disabled={disabled}
            className="text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-xl h-8 px-2.5 gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>This Month</span>
          </Button>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/60">
            Current
          </span>
        )}
      </div>
    </div>
  )
}
