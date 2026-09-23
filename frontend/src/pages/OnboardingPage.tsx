import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Sparkles,
  Wallet,
  Compass,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Coins,
  CreditCard,
  Briefcase,
  GraduationCap,
  HeartHandshake,
  CircleDollarSign,
  TrendingUp,
  PiggyBank,
  ShieldAlert,
  PieChart,
  Target,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { profileService } from '@/services/profileService'
import { formatINR } from '@/lib/utils'
import type { MoneySource, FinancialFocus } from '@/types'

const ONBOARDING_DRAFT_KEY = 'sfc_onboarding_draft'

const MONEY_SOURCE_OPTIONS: { id: MoneySource; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'Pocket Money', label: 'Pocket Money', icon: Coins, desc: 'Allowance from parents / guardians' },
  { id: 'Salary', label: 'Salary', icon: CreditCard, desc: 'Full-time or part-time job earnings' },
  { id: 'Freelance', label: 'Freelance', icon: Briefcase, desc: 'Gig work, projects & side hustles' },
  { id: 'Scholarship', label: 'Scholarship', icon: GraduationCap, desc: 'Academic grants or fellowships' },
  { id: 'Family Support', label: 'Family Support', icon: HeartHandshake, desc: 'Occasional family transfers' },
  { id: 'Other', label: 'Other', icon: CircleDollarSign, desc: 'Other student money sources' },
]

const FINANCIAL_FOCUS_OPTIONS: { id: FinancialFocus; label: string; icon: React.ElementType }[] = [
  { id: 'Track my spending', label: 'Track my spending', icon: TrendingUp },
  { id: 'Save more money', label: 'Save more money', icon: PiggyBank },
  { id: 'Control unnecessary spending', label: 'Control unnecessary spending', icon: ShieldAlert },
  { id: 'Understand where my money goes', label: 'Understand where my money goes', icon: PieChart },
  { id: 'Plan for a specific goal', label: 'Plan for a specific goal', icon: Target },
  { id: 'Just keep things organized', label: 'Just keep things organized', icon: Layers },
]

export function OnboardingPage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

  // State
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.step || 1
      }
    } catch {
      // ignore
    }
    return 1
  })

  const [moneySources, setMoneySources] = useState<MoneySource[]>(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.moneySources || []
      }
    } catch {
      // ignore
    }
    return []
  })

  const [startingBalance, setStartingBalance] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.startingBalance !== undefined ? parsed.startingBalance : ''
      }
    } catch {
      // ignore
    }
    return ''
  })

  const [financialFocus, setFinancialFocus] = useState<FinancialFocus[]>(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.financialFocus || []
      }
    } catch {
      // ignore
    }
    return []
  })

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Save progress to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({
          step,
          moneySources,
          startingBalance,
          financialFocus,
        })
      )
    } catch {
      // ignore
    }
  }, [step, moneySources, startingBalance, financialFocus])

  // Toggle money source selection
  const handleToggleSource = (source: MoneySource) => {
    setErrorMessage(null)
    setMoneySources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    )
  }

  // Toggle financial focus selection
  const handleToggleFocus = (focus: FinancialFocus) => {
    setFinancialFocus((prev) =>
      prev.includes(focus) ? prev.filter((f) => f !== focus) : [...prev, focus]
    )
  }

  // Step 2 validation
  const handleProceedFromStep2 = async () => {
    if (moneySources.length === 0) {
      setErrorMessage('Please select at least one way you usually receive money.')
      return
    }
    setErrorMessage(null)
    // Optional background autosave
    profileService
      .updateFinancialProfile({ money_sources: moneySources })
      .catch(() => {})
    setStep(3)
  }

  // Step 3 validation
  const handleProceedFromStep3 = async () => {
    const trimmed = startingBalance.trim()
    if (trimmed === '') {
      setErrorMessage('Please enter your current balance. Enter 0 if you currently have ₹0.')
      return
    }

    const num = Number(trimmed)
    if (isNaN(num)) {
      setErrorMessage('Please enter a valid numeric amount.')
      return
    }

    if (num < 0) {
      setErrorMessage('Starting balance cannot be negative.')
      return
    }

    setErrorMessage(null)
    // Optional background autosave
    profileService
      .updateFinancialProfile({
        starting_balance: num.toFixed(2),
        money_sources: moneySources,
      })
      .catch(() => {})
    setStep(4)
  }

  // Step 4 validation & progress to review
  const handleProceedFromStep4 = async () => {
    setErrorMessage(null)
    profileService
      .updateFinancialProfile({
        starting_balance: Number(startingBalance).toFixed(2),
        money_sources: moneySources,
        financial_focus: financialFocus,
      })
      .catch(() => {})
    setStep(5)
  }

  // Final Completion Handler
  const handleComplete = async () => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      const balanceNum = Number(startingBalance.trim() || '0')
      await profileService.completeOnboarding({
        starting_balance: balanceNum.toFixed(2),
        money_sources: moneySources,
        financial_focus: financialFocus,
      })

      // Clean draft
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)

      // Refresh auth user context so onboarding_completed reflects true
      await refreshUser()

      // Navigate to dashboard
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setIsSubmitting(false)
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to complete setup. Please check your network and try again.')
      }
    }
  }

  const studentName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Navigation for multi-step */}
      <div className="flex items-center justify-between">
        {step > 1 && step < 5 ? (
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null)
              setStep((s) => s - 1)
            }}
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground touch-target transition-colors"
            aria-label="Previous step"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Back</span>
          </button>
        ) : (
          <div className="h-6" />
        )}

        {step <= 4 && (
          <Badge variant="outline" className="text-[11px] font-semibold tracking-wide">
            Step {step} of 4
          </Badge>
        )}
      </div>

      {/* Progress Bar */}
      {step <= 4 && (
        <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2 animate-in fade-in duration-150"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: WELCOME */}
      {step === 1 && (
        <div className="space-y-6 text-center py-4">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Welcome to Student Financial Copilot 👋
            </h1>
            {studentName ? (
              <p className="text-sm font-semibold text-primary">Hey, {studentName}!</p>
            ) : null}
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Let's personalize your money space in under two minutes so you always know your Safe-to-Spend limit.
            </p>
          </div>

          <div className="pt-4">
            <Button
              onClick={() => setStep(2)}
              className="w-full h-12 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: MONEY SOURCES */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              How do you usually receive money?
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Select one or more sources that apply to your student lifestyle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MONEY_SOURCE_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = moneySources.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleToggleSource(option.id)}
                  aria-pressed={isSelected}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between min-h-[52px] touch-target select-none ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                      : 'bg-card border-border/80 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          isSelected ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {option.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {option.desc}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected
                        ? 'bg-primary border-primary text-white'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pt-2">
            <Button
              onClick={handleProceedFromStep2}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: CURRENT MONEY / STARTING BALANCE */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              How much money do you currently have?
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              This helps us set up your starting balance. (Enter 0 if you currently have ₹0).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-muted/30 border border-border/80 flex flex-col items-center justify-center space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="w-full max-w-xs">
              <label htmlFor="starting-balance" className="sr-only">
                Current Money
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-2xl font-bold text-muted-foreground">₹</span>
                <input
                  id="starting-balance"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={startingBalance}
                  onChange={(e) => {
                    setErrorMessage(null)
                    setStartingBalance(e.target.value)
                  }}
                  className="w-full h-14 pl-10 pr-4 text-center text-3xl font-extrabold tracking-tight bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-xs"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Bank balance, cash in wallet, or hostel emergency money.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleProceedFromStep3}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: FINANCIAL FOCUS (OPTIONAL) */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              What would you like to focus on?
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Choose any areas you want to prioritize (optional).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FINANCIAL_FOCUS_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = financialFocus.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleToggleFocus(option.id)}
                  aria-pressed={isSelected}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between min-h-[50px] touch-target select-none ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                      : 'bg-card border-border/80 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </span>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected
                        ? 'bg-primary border-primary text-white'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="pt-2">
            <Button
              onClick={handleProceedFromStep4}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: COMPLETION */}
      {step === 5 && (
        <div className="space-y-6 text-center py-2 animate-in zoom-in-95 duration-200">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              You're all set 🎉
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Your financial space is ready.
            </p>
          </div>

          {/* Profile Overview Card */}
          <Card className="p-4 rounded-2xl border-border/80 text-left space-y-3 bg-muted/20">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-xs text-muted-foreground">Starting Balance</span>
              <span className="text-sm font-bold text-foreground">
                {formatINR(Number(startingBalance || 0))}
              </span>
            </div>

            <div className="space-y-1.5 pb-2 border-b border-border/60">
              <span className="text-xs text-muted-foreground block">Money Sources</span>
              <div className="flex flex-wrap gap-1.5">
                {moneySources.map((source) => (
                  <Badge key={source} variant="secondary" className="text-[10px]">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>

            {financialFocus.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground block">Focus Areas</span>
                <div className="flex flex-wrap gap-1.5">
                  {financialFocus.map((focus) => (
                    <Badge key={focus} variant="outline" className="text-[10px]">
                      {focus}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="pt-2">
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Preparing dashboard...</span>
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" />
                  <span>Go to Dashboard</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
