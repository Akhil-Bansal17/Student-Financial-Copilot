import { TrendingUp, Sparkles, PlusCircle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function ForecastEmptyState() {
  const navigate = useNavigate()

  return (
    <Card className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
      <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
        <TrendingUp className="h-8 w-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
          Cash Flow Forecasting
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Student Financial Copilot forecasts your future cash position by combining verified starting balances, Phase 12 recurring subscriptions & bills, predictable stipends, and historical spending pace.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs text-slate-500 dark:text-slate-400 pt-1">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
          <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Deterministic</span>
          </p>
          <p className="text-[11px] mt-0.5">Calculated entirely by backend algorithms — never fabricated by AI.</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
          <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>Low-Balance Alert</span>
          </p>
          <p className="text-[11px] mt-0.5">Detects in advance when upcoming commitments might breach your safety buffer.</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
          <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-500" />
            <span>Goal Feasibility</span>
          </p>
          <p className="text-[11px] mt-0.5">Shows how much monthly contribution is safe without deficit risk.</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
        <Button
          onClick={() => navigate('/activity')}
          className="rounded-xl font-semibold text-xs h-10 px-5 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Record Transactions</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/accounts')}
          className="rounded-xl text-xs h-10 px-4 gap-1.5"
        >
          <span>Connect Bank</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
