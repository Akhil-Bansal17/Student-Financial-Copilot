import { NavLink } from 'react-router-dom'
import {
  Home,
  ListOrdered,
  Sparkles,
  Target,
  MoreHorizontal,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { label: 'Home', path: '/', icon: Home, description: 'Daily Safe-to-Spend & overview' },
  { label: 'Activity', path: '/activity', icon: ListOrdered, description: 'Transactions & allowances' },
  { label: 'Insights', path: '/insights', icon: Sparkles, description: 'Spending intelligence' },
  { label: 'Goals', path: '/goals', icon: Target, description: 'Student savings targets' },
  { label: 'More', path: '/more', icon: MoreHorizontal, description: 'Settings, campus & accounts' },
]

export function DesktopSidebar() {
  const { user } = useAuth()
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Student'
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'ST'

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-card border-r border-border/80 min-h-screen p-4 select-none shrink-0">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-3 py-4 mb-4 border-b border-border/60">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-foreground truncate">
            Financial Copilot
          </h1>
          <p className="text-xs text-muted-foreground truncate">Student Edition</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Desktop Navigation" className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all group',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    <div className="truncate">
                      <span className="block leading-none">{item.label}</span>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 opacity-0 -translate-x-1 transition-all',
                      isActive && 'opacity-100 translate-x-0 text-primary',
                      'group-hover:opacity-100 group-hover:translate-x-0'
                    )}
                  />
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom Status & Student Profile Footer */}
      <div className="pt-4 border-t border-border/60 space-y-3">
        <div className="px-2">
          <BackendStatusBadge />
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex items-center space-x-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email || 'Verified Session'}</p>
          </div>
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        </div>
      </div>
    </aside>
  )
}
