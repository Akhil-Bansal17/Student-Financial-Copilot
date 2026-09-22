import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail, User, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/services/apiClient'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Please provide your student email address.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and retype.')
      return
    }

    try {
      setIsSubmitting(true)
      await register({
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        full_name: fullName.trim() || undefined,
      })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400 && err.message.includes('already exists')) {
          setErrorMessage('An account with this email address already exists. Please log in.')
        } else if (err.status === 422) {
          setErrorMessage('Validation error: Please ensure email is valid and passwords match (min 8 characters).')
        } else if (err.status === 0 || err.status === 408) {
          setErrorMessage('Unable to connect to the server. Please check your network.')
        } else {
          setErrorMessage(err.message || 'Registration failed. Please try again.')
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Create student account</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Start your evidence-based personal finance journey
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

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <label htmlFor="reg-name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Full Name (Optional)</span>
          </label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Akhil Patel"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Student Email Address</span>
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="student@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Password (min 8 characters)</span>
          </label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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

        <div className="space-y-1">
          <label htmlFor="reg-confirm-password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Confirm Password</span>
          </label>
          <Input
            id="reg-confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl mt-2">
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating account...</span>
            </div>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/60">
        <p>
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
