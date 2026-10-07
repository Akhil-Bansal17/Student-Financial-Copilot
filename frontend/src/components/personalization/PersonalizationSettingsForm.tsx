import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  Compass,
  TrendingDown,
  PieChart,
  Sparkles,
  PiggyBank,
  Eye,
  Sliders,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  personalizationService,
  personalizationKeys,
} from '@/services/personalizationService'
import type {
  AlertSensitivity,
  FinancialPriority,
  PersonalizationProfile,
  PersonalizationProfileUpdate,
} from '@/types'

const PRIORITIES: { id: FinancialPriority; title: string; desc: string; icon: any }[] = [
  {
    id: 'BUILD_BUFFER',
    title: 'Build Cash Buffer',
    desc: 'Prioritize emergency reserves and protect against upcoming deficits.',
    icon: ShieldCheck,
  },
  {
    id: 'CONTROL_SPENDING',
    title: 'Control Spending',
    desc: 'Actively curb discretionary purchases and high-growth spending categories.',
    icon: TrendingDown,
  },
  {
    id: 'STAY_WITHIN_BUDGET',
    title: 'Stay Within Budget',
    desc: 'Keep allocations strictly within your monthly category spending limits.',
    icon: PieChart,
  },
  {
    id: 'REACH_GOALS',
    title: 'Reach Savings Goals',
    desc: 'Accelerate milestone contributions to active student goals.',
    icon: Sparkles,
  },
  {
    id: 'SAVE_MORE',
    title: 'Maximize Savings',
    desc: 'Focus on expanding your monthly net cash flow surplus.',
    icon: PiggyBank,
  },
  {
    id: 'UNDERSTAND_SPENDING',
    title: 'Understand Spending',
    desc: 'Spot recurring subscriptions, merchant patterns, and payment timing.',
    icon: Eye,
  },
  {
    id: 'BALANCED',
    title: 'Balanced Overview',
    desc: 'Maintain a steady, well-rounded perspective across all financial metrics.',
    icon: Compass,
  },
]

const SENSITIVITIES: { id: AlertSensitivity; title: string; desc: string }[] = [
  {
    id: 'CONSERVATIVE',
    title: 'Conservative',
    desc: 'Receive all smart notices, pace warnings, and positive milestones.',
  },
  {
    id: 'BALANCED',
    title: 'Balanced',
    desc: 'Standard alerts and notices relevant to your selected focus.',
  },
  {
    id: 'RELAXED',
    title: 'Relaxed',
    desc: 'Suppress low-priority notices; deliver only critical and high alerts.',
  },
]

const RECURRING_DAYS_OPTIONS = [1, 3, 5, 7]

function PersonalizationInnerForm({ profile }: { profile: PersonalizationProfile }) {
  const queryClient = useQueryClient()

  const [isEnabled, setIsEnabled] = useState(profile.is_personalization_enabled)
  const [sensitivity, setSensitivity] = useState<AlertSensitivity>(profile.alert_sensitivity)
  const [priority, setPriority] = useState<FinancialPriority>(profile.financial_priority)
  const [useCustomThreshold, setUseCustomThreshold] = useState(
    profile.large_transaction_threshold !== null && profile.large_transaction_threshold !== undefined
  )
  const [customThreshold, setCustomThreshold] = useState<string>(
    profile.large_transaction_threshold !== null && profile.large_transaction_threshold !== undefined
      ? String(profile.large_transaction_threshold)
      : ''
  )
  const [recurringDays, setRecurringDays] = useState<number>(profile.recurring_alert_days_before || 3)

  const [saveSuccess, setSaveSuccess] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (updates: PersonalizationProfileUpdate) =>
      personalizationService.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalizationKeys.all })
      setSaveSuccess(true)
      setResetSuccess(false)
      setErrorMessage(null)
      setTimeout(() => setSaveSuccess(false), 4000)
    },
    onError: (err: any) => {
      setSaveSuccess(false)
      setErrorMessage(err?.message || 'Failed to update personalization preferences.')
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => personalizationService.resetProfile(),
    onSuccess: (resetProf) => {
      queryClient.invalidateQueries({ queryKey: personalizationKeys.all })
      setIsEnabled(resetProf.is_personalization_enabled)
      setSensitivity(resetProf.alert_sensitivity)
      setPriority(resetProf.financial_priority)
      setUseCustomThreshold(false)
      setCustomThreshold('')
      setRecurringDays(resetProf.recurring_alert_days_before || 3)
      setResetSuccess(true)
      setSaveSuccess(false)
      setErrorMessage(null)
      setTimeout(() => setResetSuccess(false), 4000)
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to reset personalization preferences.')
    },
  })

  const handleReset = () => {
    setErrorMessage(null)
    resetMutation.mutate()
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    let thresholdVal: string | number | null = null
    if (useCustomThreshold) {
      const num = parseFloat(customThreshold)
      if (isNaN(num) || num <= 0) {
        setErrorMessage('Please enter a valid positive number for the large transaction threshold.')
        return
      }
      thresholdVal = num
    }

    mutation.mutate({
      is_personalization_enabled: isEnabled,
      alert_sensitivity: sensitivity,
      financial_priority: priority,
      large_transaction_threshold: thresholdVal,
      recurring_alert_days_before: recurringDays,
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-6" data-testid="personalization-settings-form">
      {/* Master Toggle */}
      <Card className="rounded-2xl border border-border/80 p-5 bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <label
              htmlFor="personalization-toggle"
              className="text-base font-semibold text-foreground cursor-pointer block"
            >
              Adaptive Financial Personalization
            </label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              When enabled, your chosen focus and sensitivity guide smart alerts and action order without altering financial facts.
            </p>
          </div>
          <input
            type="checkbox"
            id="personalization-toggle"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      </Card>

      {/* Financial Priority Selector */}
      <Card className="rounded-2xl border border-border/80 p-5 space-y-4 bg-card">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-foreground">
              Primary Financial Focus
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Select your current financial goal. This elevates relevant smart recommendations to the top of your feed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {PRIORITIES.map((p) => {
            const Icon = p.icon
            const isSelected = priority === p.id
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPriority(p.id)}
                disabled={!isEnabled}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-start gap-3 ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-border/70 hover:border-border hover:bg-muted/40'
                } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground block truncate">
                    {p.title}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug line-clamp-2 block">
                    {p.desc}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Alert Sensitivity */}
      <Card className="rounded-2xl border border-border/80 p-5 space-y-4 bg-card">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-foreground">
              Notification Sensitivity
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tune how aggressively you receive pacing updates and informational alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {SENSITIVITIES.map((s) => {
            const isSelected = sensitivity === s.id
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setSensitivity(s.id)}
                disabled={!isEnabled}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-border/70 hover:border-border hover:bg-muted/40'
                } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div>
                  <span className="text-sm font-semibold text-foreground block">
                    {s.title}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug mt-1 block">
                    {s.desc}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Safety Guarantee */}
        <div className="rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Safety Guarantee:</strong> Critical alerts (such as negative cash flow projections, severe budget overruns, and bank synchronization issues) will NEVER be suppressed regardless of your sensitivity selection.
          </span>
        </div>
      </Card>

      {/* Large Transaction Threshold Sensitivity */}
      <Card className="rounded-2xl border border-border/80 p-5 space-y-4 bg-card">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Large Transaction Notification Threshold
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Identify unusually large expenditures in your transaction feed.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="custom-large-toggle"
              data-testid="custom-large-toggle"
              checked={useCustomThreshold}
              onChange={(e) => setUseCustomThreshold(e.target.checked)}
              disabled={!isEnabled}
              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label
              htmlFor="custom-large-toggle"
              className="text-xs sm:text-sm font-medium text-foreground cursor-pointer"
            >
              Specify a custom threshold amount instead of automatic baseline
            </label>
          </div>

          {useCustomThreshold && (
            <div className="pt-1 max-w-xs">
              <label
                htmlFor="custom-threshold-input"
                className="text-xs font-semibold text-muted-foreground block mb-1"
              >
                Threshold Amount (₹)
              </label>
              <input
                id="custom-threshold-input"
                data-testid="custom-threshold-input"
                type="number"
                step="50"
                min="100"
                placeholder="e.g. 3500"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                disabled={!isEnabled}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Recurring Bill Reminder Lead Time */}
      <Card className="rounded-2xl border border-border/80 p-5 space-y-4 bg-card">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Recurring Bill Reminder Timing
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              How many days in advance should upcoming subscriptions and recurring commitments trigger an alert?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {RECURRING_DAYS_OPTIONS.map((days) => (
            <button
              type="button"
              key={days}
              onClick={() => setRecurringDays(days)}
              disabled={!isEnabled}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                recurringDays === days
                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500'
                  : 'bg-background border-border/80 text-foreground hover:bg-muted/60'
              } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {days} Day{days > 1 ? 's' : ''} Prior
            </button>
          ))}
        </div>
      </Card>

      {/* Feedback & Error states */}
      {saveSuccess && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2" data-testid="save-success-banner">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Your personalization settings have been updated and saved successfully!</span>
        </div>
      )}

      {resetSuccess && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2" data-testid="reset-success-banner">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Personalization preferences have been reset to default values. Ledger history and accounts remain intact.</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2" data-testid="save-error-banner">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons: Reset & Save */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={resetMutation.isPending || mutation.isPending}
          className="rounded-xl px-4 py-2.5 font-medium border-border/80 hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center gap-2"
          data-testid="reset-personalization-btn"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{resetMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}</span>
        </Button>

        <Button
          type="submit"
          disabled={mutation.isPending || resetMutation.isPending}
          className="rounded-xl px-6 py-2.5 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          data-testid="save-personalization-btn"
        >
          {mutation.isPending ? 'Saving Preferences...' : 'Save Preferences'}
        </Button>
      </div>
    </form>
  )
}

export function PersonalizationSettingsForm() {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: personalizationKeys.profile(),
    queryFn: () => personalizationService.getProfile(),
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/80 p-6 space-y-6 bg-card" data-testid="settings-form-loading">
        <Skeleton className="h-6 w-52 rounded-md" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </Card>
    )
  }

  if (isError || !profile) {
    return (
      <Card className="rounded-2xl border border-destructive/30 p-6 text-center space-y-2 bg-card">
        <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
        <h4 className="text-sm font-semibold text-foreground">Could not load preferences</h4>
        <p className="text-xs text-muted-foreground">Please check your connection and refresh the page.</p>
      </Card>
    )
  }

  return <PersonalizationInnerForm profile={profile} />
}
