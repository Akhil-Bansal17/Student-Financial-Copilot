import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  className?: string
  compact?: boolean
}

export function LoadingState({ message = 'Loading financial data...', className, compact = false }: LoadingStateProps) {
  if (compact) {
    return (
      <div className={cn('flex items-center space-x-2 text-muted-foreground text-sm py-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{message}</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center p-8 text-center min-h-[160px]', className)}
    >
      <div className="rounded-full bg-primary/10 p-3 mb-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      <span className="sr-only">Loading content</span>
    </div>
  )
}
