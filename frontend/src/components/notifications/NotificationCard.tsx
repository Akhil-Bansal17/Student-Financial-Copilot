import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Calendar,
  Wallet,
  Target,
  RefreshCw,
  Landmark,
  TrendingUp,
  ArrowRight,
  Check,
} from 'lucide-react';
import type { NotificationItem, NotificationPriority } from '@/types/notification';

interface NotificationCardProps {
  notification: NotificationItem;
  onMarkAsRead?: (id: number) => void;
  isMarkingRead?: boolean;
}

export function NotificationCard({
  notification,
  onMarkAsRead,
  isMarkingRead,
}: NotificationCardProps) {
  const navigate = useNavigate();

  const getPriorityStyle = (priority: NotificationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return {
          badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          cardBorder: 'border-l-4 border-l-rose-500',
          icon: <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />,
        };
      case 'HIGH':
        return {
          badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          cardBorder: 'border-l-4 border-l-amber-500',
          icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
        };
      case 'MEDIUM':
        return {
          badgeBg: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
          cardBorder: 'border-l-4 border-l-yellow-500',
          icon: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
        };
      case 'LOW':
        return {
          badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          cardBorder: 'border-l-4 border-l-blue-400',
          icon: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
        };
      case 'INFO':
      default:
        return {
          badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          cardBorder: 'border-l-4 border-l-emerald-500',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
        };
    }
  };

  const getCategoryIcon = (type: string) => {
    if (type.startsWith('FORECAST_')) return <Calendar className="h-4 w-4 text-indigo-500" />;
    if (type.startsWith('BUDGET_')) return <Wallet className="h-4 w-4 text-purple-500" />;
    if (type.startsWith('GOAL_')) return <Target className="h-4 w-4 text-emerald-500" />;
    if (type.startsWith('RECURRING_')) return <RefreshCw className="h-4 w-4 text-cyan-500" />;
    if (type.startsWith('BANK_')) return <Landmark className="h-4 w-4 text-sky-500" />;
    if (type.startsWith('SPENDING_')) return <TrendingUp className="h-4 w-4 text-orange-500" />;
    return <Info className="h-4 w-4 text-primary" />;
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const priorityStyle = getPriorityStyle(notification.priority);

  return (
    <div
      className={`relative rounded-xl border bg-card/80 p-4 transition-all duration-200 hover:shadow-sm ${
        priorityStyle.cardBorder
      } ${!notification.is_read ? 'bg-primary/5 dark:bg-primary/[0.03] border-primary/20' : 'border-border/70'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5 rounded-lg bg-muted/60 p-2 text-foreground">
            {getCategoryIcon(notification.notification_type)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center space-x-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${priorityStyle.badgeBg}`}
              >
                {priorityStyle.icon}
                <span>{notification.priority}</span>
              </span>

              {!notification.is_read && (
                <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                  New
                </span>
              )}
            </div>

            <h3 className="mt-1 text-sm font-semibold text-foreground tracking-tight sm:text-base">
              {notification.title}
            </h3>
          </div>
        </div>

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground leading-relaxed sm:text-sm pl-11">
        {notification.message}
      </p>

      {/* Action CTA & Mark as Read */}
      <div className="mt-3 flex items-center justify-between pl-11 pt-1 border-t border-border/40">
        <div>
          {notification.action_url && (
            <button
              type="button"
              onClick={() => {
                if (notification.action_url) {
                  navigate(notification.action_url);
                }
              }}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:underline hover:text-primary/90 transition-colors"
            >
              <span>View details</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {!notification.is_read && onMarkAsRead && (
          <button
            type="button"
            onClick={() => onMarkAsRead(notification.id)}
            disabled={isMarkingRead}
            className="inline-flex items-center space-x-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/70 disabled:opacity-50"
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Mark read</span>
          </button>
        )}
      </div>
    </div>
  );
}
