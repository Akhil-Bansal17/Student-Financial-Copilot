import { Link } from 'react-router-dom'
import { Building2, AlertTriangle, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BankFreshnessDetail } from '@/types/financialHealth'

interface BankFreshnessBannerProps {
  freshness: BankFreshnessDetail
}

export function BankFreshnessBanner({ freshness }: BankFreshnessBannerProps) {
  if (!freshness.has_connected_bank) {
    return null
  }

  const isStaleOrDelayed = freshness.is_stale || freshness.sync_status === 'FAILED' || freshness.sync_status === 'DELAYED'

  return (
    <Card
      className={`rounded-2xl border p-3.5 sm:p-4 transition-colors ${
        isStaleOrDelayed
          ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20'
          : 'border-border/70 bg-card/60'
      }`}
      data-testid="bank-freshness-banner"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isStaleOrDelayed
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isStaleOrDelayed ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                Bank Data Freshness
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] py-0 px-1.5 font-medium ${
                  isStaleOrDelayed
                    ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                }`}
              >
                {isStaleOrDelayed ? 'Delayed Sync' : 'Synchronized'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {freshness.freshness_description}
            </p>
          </div>
        </div>

        <Link
          to="/connected-accounts"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0 self-end sm:self-auto"
        >
          <span>Manage Bank Accounts</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}
