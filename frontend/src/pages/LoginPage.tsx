import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/services/apiClient'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Please enter your student email address.')
      return
    }

    if (!password) {
      setErrorMessage('Please enter your password.')
      return
    }

    try {
      setIsSubmitting(true)
      await login({ email: email.trim(), password })
      navigate(fromPath, { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Invalid email or password. Please check your credentials.')
        } else if (err.status === 403) {
          setErrorMessage('This student account is currently deactivated.')
        } else if (err.status === 0 || err.status === 408) {
          setErrorMessage('Unable to reach server. Please check your internet connection.')
        } else {
          setErrorMessage(err.message || 'An error occurred while logging in. Please try again.')
        }
      } else {
        setErrorMessage('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sign in to your Student Financial Copilot
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900 p-3.5 flex items-start space-x-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Student Email</span>
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="student@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Password</span>
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="pr-10"
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground touch-target flex items-center justify-center transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl">
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            'Log in'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/60">
        <p>
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
