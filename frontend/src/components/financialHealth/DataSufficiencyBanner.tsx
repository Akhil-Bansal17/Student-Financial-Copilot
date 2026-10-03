import { Link } from 'react-router-dom'
import { Info, PlusCircle, Building2, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { DataSufficiencyLevel } from '@/types/financialHealth'

interface DataSufficiencyBannerProps {
  sufficiency: DataSufficiencyLevel
  summary?: string
}

export function DataSufficiencyBanner({ sufficiency, summary }: DataSufficiencyBannerProps) {
  if (sufficiency === 'STRONG' || sufficiency === 'MODERATE') {
    return null
  }

  const isInsufficient = sufficiency === 'INSUFFICIENT'

  return (
    <Card
      className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 p-4 transition-colors space-y-3"
      data-testid="data-sufficiency-banner"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
          <Info className="h-4 w-4" />
        </div>

        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              {isInsufficient ? 'Building Financial Health Baseline' : 'Limited Historical Data'}
            </h4>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
              {sufficiency}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {summary ||
              (isInsufficient
                ? 'Your assessment is currently limited because there is insufficient recent transaction history. Record daily campus expenses or connect your bank account to unlock full insights.'
                : 'Your assessment is based on limited recent history. Trends and projections will become more accurate as additional daily activity is recorded.')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-blue-200/50 dark:border-blue-900/30 flex-wrap">
        <Link
          to="/activity"
          className="inline-flex items-center justify-center h-7 text-xs rounded-xl px-2.5 font-medium gap-1 border border-input bg-background hover:bg-muted hover:text-foreground transition-colors"
        >
          <PlusCircle className="h-3 w-3" />
          <span>Add Transaction</span>
        </Link>

        <Link
          to="/connected-accounts"
          className="inline-flex items-center justify-center h-7 text-xs rounded-xl px-2.5 font-medium gap-1 text-primary hover:text-primary/90 hover:bg-muted/50 transition-colors"
        >
          <Building2 className="h-3 w-3" />
          <span>Connect Bank</span>
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Link>
      </div>
    </Card>
  )
}
