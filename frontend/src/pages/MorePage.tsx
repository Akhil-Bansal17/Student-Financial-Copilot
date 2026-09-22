import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Coins,
  Smartphone,
  ChevronRight,
  Info,
  LogOut,
  Loader2,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge'
import { useAuth } from '@/hooks/useAuth'

export function MorePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

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
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          More & Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Preferences, student profile, and session management
        </p>
      </div>

      {/* Student Profile Card (Dynamic from Backend) */}
      <Card className="rounded-2xl border-border/80 p-5 flex items-center space-x-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary font-bold text-lg flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground truncate">
              {user?.full_name || 'Student Account'}
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              Active Student
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3 w-3" />
            <span>{user?.email}</span>
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Student ID: #{user?.id} · Verified Session</span>
          </p>
        </div>
      </Card>

      {/* Preferences Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Preferences
        </h3>

        <Card className="rounded-2xl border-border/80 overflow-hidden divide-y divide-border/60">
          <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center space-x-3">
              <Coins className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Default Currency</p>
                <p className="text-xs text-muted-foreground">Indian Rupee (₹ INR)</p>
              </div>
            </div>
            <Badge variant="outline">₹ INR</Badge>
          </div>

          <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Campus Profile</p>
                <p className="text-xs text-muted-foreground">Academic term & hostel details</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">PWA Installation</p>
                <p className="text-xs text-muted-foreground">Add FinCopilot to your home screen</p>
              </div>
            </div>
            <Badge variant="success" className="text-[10px]">
              PWA Ready
            </Badge>
          </div>
        </Card>
      </div>

      {/* Onboarding Tour Link */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Campus Guides
        </h3>

        <Card className="rounded-2xl border-border/80 overflow-hidden">
          <Link
            to="/onboarding"
            className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Onboarding Tour</p>
                <p className="text-xs text-muted-foreground">First-run student budgeting guide</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Card>
      </div>

      {/* System Diagnostics */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          System & Diagnostics
        </h3>

        <Card className="rounded-2xl border-border/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              <span>FastAPI Backend Health</span>
            </div>
            <BackendStatusBadge />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            API Version: <code>v0.1.0</code> · Authentication: <code>JWT Bearer (HS256)</code>
          </p>
        </Card>
      </div>

      {/* Account Security & Logout */}
      <div className="pt-2">
        <Button
          variant="destructive"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full h-12 rounded-xl flex items-center justify-center space-x-2 text-sm font-semibold"
        >
          {isLoggingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Logging out...</span>
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              <span>Log out of FinCopilot</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
