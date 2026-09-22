import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  position?: 'bottom' | 'right'
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  position = 'bottom',
}: SheetProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isBottom = position === 'bottom'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
        className={cn(
          'relative z-50 w-full bg-background shadow-elevation border-t sm:border border-border p-6 transition-all',
          isBottom
            ? 'rounded-t-3xl max-h-[85vh] overflow-y-auto sm:max-w-md sm:rounded-2xl'
            : 'h-full max-w-md ml-auto'
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div>
            {title && (
              <h2 id="sheet-title" className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground touch-target flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4">{children}</div>
      </div>
    </div>
  )
}
