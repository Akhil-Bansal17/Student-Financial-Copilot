import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { notificationService, notificationKeys } from '@/services/notificationService';

export function DashboardAlertsCard() {
  const navigate = useNavigate();

  const { data: unreadData, isLoading } = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
  });

  const { data: notifData } = useQuery({
    queryKey: notificationKeys.list({ isRead: false, pageSize: 2 }),
    queryFn: () => notificationService.getNotifications({ isRead: false, pageSize: 2 }),
    enabled: Boolean(unreadData && unreadData.unread_count > 0),
  });

  if (isLoading || !unreadData || unreadData.unread_count === 0) {
    return null;
  }

  const hasCritical = unreadData.critical_count > 0;
  const topAlert = notifData?.items[0];

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 shadow-xs mb-4 ${
        hasCritical
          ? 'bg-rose-500/[0.06] border-rose-500/25 dark:bg-rose-950/20'
          : 'bg-amber-500/[0.06] border-amber-500/25 dark:bg-amber-950/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div
            className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
              hasCritical ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            {hasCritical ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">
              {unreadData.unread_count} {unreadData.unread_count === 1 ? 'alert needs' : 'alerts need'} your attention
            </h3>
            {topAlert ? (
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate max-w-[220px] sm:max-w-xs">
                {topAlert.title}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {unreadData.critical_count > 0 ? `${unreadData.critical_count} critical item(s)` : 'Review your latest notices'}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:underline hover:text-primary/90 transition-colors shrink-0"
        >
          <span>View all</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
