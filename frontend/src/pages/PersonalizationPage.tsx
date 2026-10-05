import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sliders,
  Layers,
  ChevronLeft,
  Sparkles,
  Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PersonalizationSettingsForm } from '@/components/personalization/PersonalizationSettingsForm'
import { BehavioralSignalsCard } from '@/components/personalization/BehavioralSignalsCard'

export function PersonalizationPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'signals'>('settings')

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-4 animate-in fade-in duration-200" data-testid="personalization-page">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/more"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>More Preferences</span>
        </Link>
        <Badge
          variant="outline"
          className="border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 text-xs px-2.5 py-0.5 rounded-full"
        >
          Phase 16 Active
        </Badge>
      </div>

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Financial Personalization & Adaptive Intelligence
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Customize your financial priority focus, notification sensitivity, and thresholds.
          Your explicit choices tailor smart actions and alerts while keeping all ledger records and calculations strictly authoritative.
        </p>
      </div>

      {/* Informational Banner */}
      <div className="rounded-xl border border-indigo-200/50 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/15 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <span>
          <strong>Deterministic Guarantee:</strong> Personalization adapts presentation and priority without mutating account balances, transactions, budgets, or goal amounts.
        </span>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex items-center border-b border-border/80 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-settings"
        >
          <Sliders className="h-4 w-4" />
          <span>Focus & Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('signals')}
          className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'signals'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-signals"
        >
          <Layers className="h-4 w-4" />
          <span>Observed Signals</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'settings' ? (
        <PersonalizationSettingsForm />
      ) : (
        <BehavioralSignalsCard />
      )}
    </div>
  )
}
