import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, GraduationCap } from 'lucide-react'
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge'
import { notificationService, notificationKeys } from '@/services/notificationService'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const { data: unreadData } = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000,
  })

  const unreadCount = unreadData?.unread_count || 0
  const criticalCount = unreadData?.critical_count || 0
  const accessibleLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

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

          <Link
            to="/notifications"
            aria-label={accessibleLabel}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors touch-target flex items-center justify-center relative"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-200 ${
                  criticalCount > 0 ? 'bg-rose-500' : 'bg-primary'
                }`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}

