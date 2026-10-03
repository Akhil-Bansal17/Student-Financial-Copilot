import { CheckCircle2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { PositiveSignalItem } from '@/types/financialHealth'

interface PositiveSignalCardProps {
  signal: PositiveSignalItem
}

export function PositiveSignalCard({ signal }: PositiveSignalCardProps) {
  return (
    <Card
      className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-4 transition-all duration-200 hover:shadow-sm flex items-start gap-3"
      data-testid={`positive-signal-${signal.id}`}
    >
      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
        <CheckCircle2 className="h-4 w-4" />
      </div>

      <div className="space-y-1 min-w-0 flex-1">
        <h4 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <span>{signal.title}</span>
          <Sparkles className="h-3 w-3 text-emerald-500 shrink-0" />
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {signal.description}
        </p>
      </div>
    </Card>
  )
}
