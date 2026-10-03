import { Link } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ArrowRight,
  TrendingDown,
  Layers,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SmartActionItem, ActionPriority } from '@/types/financialHealth'

interface SmartActionCardProps {
  action: SmartActionItem
}

function getPriorityBadgeConfig(priority: ActionPriority) {
  switch (priority) {
    case 'CRITICAL':
      return {
        variant: 'destructive' as const,
        label: 'CRITICAL',
        className: 'bg-rose-600 text-white font-bold tracking-wider text-[10px] px-2 py-0.5',
        icon: <AlertOctagon className="h-3 w-3 mr-1" />,
        borderClass: 'border-rose-400 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20',
      }
    case 'HIGH':
      return {
        variant: 'outline' as const,
        label: 'HIGH PRIORITY',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold text-[10px] px-2 py-0.5',
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        borderClass: 'border-amber-300 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/10',
      }
    case 'MEDIUM':
      return {
        variant: 'outline' as const,
        label: 'MEDIUM',
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-semibold text-[10px] px-2 py-0.5',
        icon: <Layers className="h-3 w-3 mr-1" />,
        borderClass: 'border-blue-200/80 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-950/5',
      }
    case 'LOW':
      return {
        variant: 'secondary' as const,
        label: 'LOW',
        className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 font-medium text-[10px] px-2 py-0.5',
        icon: <TrendingDown className="h-3 w-3 mr-1" />,
        borderClass: 'border-border/80 bg-card',
      }
    case 'INFO':
    default:
      return {
        variant: 'secondary' as const,
        label: 'INFO',
        className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 font-medium text-[10px] px-2 py-0.5',
        icon: <Info className="h-3 w-3 mr-1" />,
        borderClass: 'border-border/80 bg-card',
      }
  }
}

export function SmartActionCard({ action }: SmartActionCardProps) {
  const config = getPriorityBadgeConfig(action.priority)

  return (
    <Card
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md space-y-3.5 ${config.borderClass}`}
      data-testid={`action-card-${action.id}`}
    >
      {/* Header: Priority + Title */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <Badge
            variant={config.variant}
            className={`rounded-md flex items-center w-fit ${config.className}`}
          >
            {config.icon}
            <span>{config.label}</span>
          </Badge>
          <h4 className="text-sm sm:text-base font-semibold text-foreground tracking-tight pt-0.5">
            {action.title}
          </h4>
        </div>
      </div>

      {/* Description & Underlying Reason */}
      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
        {action.description}
      </p>

      {/* Supporting Metric / Evidence Pill if present */}
      {action.supporting_metric && (
        <div className="inline-block bg-muted/60 text-muted-foreground rounded-lg px-2.5 py-1 text-[11px] font-mono border border-border/50">
          <span>Evidence: </span>
          <strong className="text-foreground">{action.supporting_metric}</strong>
        </div>
      )}

      {/* Next Step CTA Action */}
      <div className="pt-1 flex items-center justify-between gap-3 flex-wrap border-t border-border/50">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-1 min-w-[200px]">
          <span className="font-medium text-foreground">Next Step:</span>
          <span>{action.recommended_next_step}</span>
        </p>

        {action.action_url && (
          <Link
            to={action.action_url}
            className={`inline-flex items-center justify-center h-8 text-xs rounded-xl px-3 font-medium gap-1 shrink-0 transition-colors shadow-xs ${
              action.priority === 'CRITICAL'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : action.priority === 'HIGH'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>Take Action</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Card>
  )
}
