import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-rose-200/80 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 p-6 text-center flex flex-col items-center justify-center space-y-3',
        className
      )}
    >
      <div className="rounded-full bg-rose-100 dark:bg-rose-900/50 p-3 text-rose-600 dark:text-rose-400">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">{title}</h4>
        <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 text-xs border-rose-200 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Try Again
        </Button>
      )}
    </div>
  )
}
