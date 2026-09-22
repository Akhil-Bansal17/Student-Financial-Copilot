import { Outlet, Link } from 'react-router-dom'
import { GraduationCap, ArrowLeft } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          to="/"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground mb-6 touch-target"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="flex items-center justify-center space-x-2.5 mb-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">FinCopilot</h1>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Student-first smart financial guidance
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-6 shadow-card border border-border/80 rounded-2xl sm:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
