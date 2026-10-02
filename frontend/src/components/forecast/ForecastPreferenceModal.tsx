import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, SlidersHorizontal, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/utils'
import { forecastService, forecastKeys } from '@/services/forecastService'

interface ForecastPreferenceModalProps {
  isOpen: boolean
  onClose: () => void
  currentThreshold: number | string
}

interface DialogProps {
  onClose: () => void
  currentThreshold: number | string
}

function ForecastPreferenceDialog({ onClose, currentThreshold }: DialogProps) {
  const queryClient = useQueryClient()
  const [threshold, setThreshold] = useState<string>(String(currentThreshold))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const mutation = useMutation({
    mutationFn: (newThreshold: number) =>
      forecastService.updatePreference({ minimum_balance_threshold: newThreshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forecastKeys.all })
      setFeedback('Minimum balance threshold updated successfully!')
      setTimeout(() => {
        onClose()
      }, 1000)
    },
    onError: () => {
      setErrorMsg('Failed to update minimum balance threshold.')
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const val = parseFloat(threshold)
    if (isNaN(val) || val < 0) {
      setErrorMsg('Please enter a valid non-negative amount.')
      return
    }
    mutation.mutate(val)
  }

  const PRESETS = [1000, 2000, 3000, 5000, 10000]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pref-modal-title"
      data-testid="forecast-preference-modal"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 id="pref-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Forecast Preferences
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your safety reserve & low balance alert point
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Minimum Preferred Balance (₹)
            </label>
            <Input
              type="number"
              step="100"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="h-11 rounded-xl text-base font-mono font-medium"
              placeholder="2000"
              required
            />
            <p className="text-[11px] text-slate-500">
              When your deterministic forecast dips below this reserve, you will receive low-balance notifications and planning buffers.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500">Quick Presets:</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setThreshold(String(amt))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    Number(threshold) === amt
                      ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {formatINR(amt, 0)}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          {feedback && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl h-10 px-4 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl h-10 px-5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Preference
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ForecastPreferenceModal({
  isOpen,
  onClose,
  currentThreshold,
}: ForecastPreferenceModalProps) {
  if (!isOpen) return null

  return (
    <ForecastPreferenceDialog
      onClose={onClose}
      currentThreshold={currentThreshold}
    />
  )
}
