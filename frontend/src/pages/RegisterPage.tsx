import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail, User, School } from 'lucide-react'

export function RegisterPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Create student account</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Start building financial clarity during your campus years
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Full Name</span>
          </label>
          <Input type="text" placeholder="Akhil Patel" defaultValue="Akhil Patel" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <School className="h-3.5 w-3.5 text-muted-foreground" />
            <span>College / University</span>
          </label>
          <Input type="text" placeholder="State Institute of Technology" defaultValue="Campus University" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Email Address</span>
          </label>
          <Input type="email" placeholder="student@campus.edu" defaultValue="akhil@campus.edu" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Password</span>
          </label>
          <Input type="password" placeholder="••••••••" defaultValue="secretpass123" />
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl">
          Create Account (Placeholder)
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/60">
        <p>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
