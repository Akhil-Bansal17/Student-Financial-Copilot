import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail } from 'lucide-react'

export function LoginPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sign in to your student financial workspace
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Student Email</span>
          </label>
          <Input type="email" placeholder="student@university.edu" defaultValue="student@campus.edu" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Password</span>
          </label>
          <Input type="password" placeholder="••••••••" defaultValue="password123" />
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl">
          Sign In (Placeholder)
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/60">
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Register here
          </Link>
        </p>
        <p className="text-[11px] opacity-75">
          Authentication logic will be implemented in Phase 2.
        </p>
      </div>
    </div>
  )
}
