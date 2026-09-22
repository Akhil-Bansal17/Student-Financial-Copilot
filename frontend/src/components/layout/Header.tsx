import { Bell, GraduationCap } from 'lucide-react'
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-border/60 transition-colors">
      <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Left: Mobile Brand or Page Title */}
        <div className="flex items-center space-x-2.5">
          <div className="md:hidden flex items-center space-x-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">FinCopilot</span>
          </div>

          <div className="hidden md:block">
            {title ? (
              <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
            ) : (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Student Finance Dashboard
              </span>
            )}
          </div>
        </div>

        {/* Right: Backend Status & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <BackendStatusBadge />

          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors touch-target flex items-center justify-center relative"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </header>
  )
}
