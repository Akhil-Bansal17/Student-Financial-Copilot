import { NavLink } from 'react-router-dom'
import { Home, ListOrdered, Sparkles, Target, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Activity', path: '/activity', icon: ListOrdered },
  { label: 'Insights', path: '/insights', icon: Sparkles },
  { label: 'Goals', path: '/goals', icon: Target },
  { label: 'More', path: '/more', icon: MoreHorizontal },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/80 safe-bottom transition-all"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 select-none touch-target transition-all duration-150',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                )
              }
            >
              {({ isActive }) => (
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div
                    className={cn(
                      'p-1 rounded-xl transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] leading-none tracking-tight">{item.label}</span>
                </div>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
