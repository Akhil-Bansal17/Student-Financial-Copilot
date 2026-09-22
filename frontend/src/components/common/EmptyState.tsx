import React from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-border p-8 text-center flex flex-col items-center justify-center space-y-3 bg-muted/20',
        className
      )}
    >
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-2 text-xs">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
