import { Link } from 'react-router-dom'
import {
  User,
  GraduationCap,
  Coins,
  Shield,
  Smartphone,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge'

export function MorePage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          More & Settings
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Preferences, student profile, and system status
        </p>
      </div>

      {/* Student Profile Card */}
      <Card className="rounded-2xl border-border/80 p-5 flex items-center space-x-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary font-bold text-lg flex items-center justify-center shrink-0">
          AP
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground truncate">Akhil Patel</h2>
            <Badge variant="secondary" className="text-[10px]">Student</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">B.Tech Computer Science · Year 3</p>
          <p className="text-xs text-muted-foreground truncate">Campus ID: #SFC-2026-89</p>
        </div>
      </Card>

      {/* Settings Sections */}
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
            <Badge variant="success" className="text-[10px]">PWA Ready</Badge>
          </div>
        </Card>
      </div>

      {/* Auth Routes / Onboarding Links */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Account & Authentication Placeholders
        </h3>

        <Card className="rounded-2xl border-border/80 overflow-hidden divide-y divide-border/60">
          <Link
            to="/login"
            className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Login Screen</p>
                <p className="text-xs text-muted-foreground">Placeholder authentication route</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            to="/register"
            className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Registration Screen</p>
                <p className="text-xs text-muted-foreground">Student onboarding sign up</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            to="/onboarding"
            className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Onboarding Tour</p>
                <p className="text-xs text-muted-foreground">First-run student experience</p>
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
            API Version: <code>v0.1.0</code> · Protocol: <code>REST (JSON)</code> · Port: <code>8000</code>
          </p>
        </Card>
      </div>
    </div>
  )
}
