import { CheckCircle2 } from 'lucide-react';

interface NotificationEmptyStateProps {
  filterType?: string;
}

export function NotificationEmptyState({ filterType = 'all' }: NotificationEmptyStateProps) {
  const isUnreadFilter = filterType === 'unread';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-6">
      <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3 shadow-xs">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">
        {isUnreadFilter ? 'All Caught Up!' : 'No Notifications'}
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm">
        {isUnreadFilter
          ? 'You have reviewed all your urgent alerts and financial notices. Everything is clear!'
          : 'You will receive intelligent alerts here when budgets, bills, or forecasts require your attention.'}
      </p>
    </div>
  );
}
