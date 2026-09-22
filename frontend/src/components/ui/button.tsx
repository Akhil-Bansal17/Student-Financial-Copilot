import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]'

    const variants = {
      default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-input bg-background hover:bg-muted hover:text-foreground',
      ghost: 'hover:bg-muted hover:text-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      subtle: 'bg-primary/10 text-primary hover:bg-primary/20',
    }

    const sizes = {
      default: 'h-11 px-4 py-2 text-sm min-h-touch', // Mobile thumb-friendly min 44px
      sm: 'h-9 px-3 text-xs',
      lg: 'h-12 px-6 text-base min-h-touch',
      icon: 'h-11 w-11 min-h-touch min-w-touch p-2',
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
