import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  Settings,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { notificationService, notificationKeys } from '@/services/notificationService';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { NotificationEmptyState } from '@/components/notifications/NotificationEmptyState';
import { NotificationPreferencesModal } from '@/components/notifications/NotificationPreferencesModal';

type FilterTab = 'all' | 'unread';
type CategoryFilter = 'ALL' | 'CRITICAL_HIGH' | 'BUDGET' | 'FORECAST' | 'RECURRING' | 'BANK';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const pageSize = 15;

  // Unread count query
  const { data: unreadData } = useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
  });

  // Query notifications with current filters
  const isReadFilter = activeTab === 'unread' ? false : undefined;

  const {
    data: notifData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: notificationKeys.list({
      isRead: isReadFilter,
      page: currentPage,
      pageSize,
    }),
    queryFn: () =>
      notificationService.getNotifications({
        isRead: isReadFilter,
        page: currentPage,
        pageSize,
      }),
  });

  // Mark single as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markAsRead(id),
    onSuccess: (updated) => {
      // Optimistically update notifications in cache
      queryClient.setQueriesData(
        { queryKey: notificationKeys.all },
        (old: any) => {
          if (!old || !old.items) return old;
          return {
            ...old,
            items: old.items.map((item: any) =>
              item.id === updated.id ? { ...item, is_read: true, read_at: updated.read_at } : item
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // Evaluate smart alerts on-demand mutation
  const evaluateMutation = useMutation({
    mutationFn: () => notificationService.evaluateAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // Category filtering
  const filteredItems = (notifData?.items || []).filter((item) => {
    if (categoryFilter === 'CRITICAL_HIGH') {
      return item.priority === 'CRITICAL' || item.priority === 'HIGH';
    }
    if (categoryFilter === 'BUDGET') {
      return item.notification_type.startsWith('BUDGET_');
    }
    if (categoryFilter === 'FORECAST') {
      return item.notification_type.startsWith('FORECAST_');
    }
    if (categoryFilter === 'RECURRING') {
      return item.notification_type.startsWith('RECURRING_');
    }
    if (categoryFilter === 'BANK') {
      return item.notification_type.startsWith('BANK_');
    }
    return true;
  });

  const totalPages = notifData?.total_pages || 1;
  const unreadCount = unreadData?.unread_count || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Authoritative, intelligent alerts and important financial updates.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted/70 text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending || isFetching}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Check for new alerts"
          >
            <RefreshCw
              className={`h-4 w-4 ${evaluateMutation.isPending || isFetching ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
            title="Notification preferences"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs & Category Filter Pills */}
      <div className="space-y-3">
        {/* Tabs: All vs Unread */}
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-muted/50 border border-border/80 w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Notifications
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('unread');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'unread'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All Types
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('CRITICAL_HIGH')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'CRITICAL_HIGH'
                ? 'bg-rose-500 text-white border-rose-500 font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Urgent Only
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('BUDGET')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'BUDGET'
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Budgets
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('FORECAST')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'FORECAST'
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Forecast
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('RECURRING')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'RECURRING'
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Recurring Bills
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('BANK')}
            className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              categoryFilter === 'BANK'
                ? 'bg-primary text-primary-foreground border-primary font-medium'
                : 'bg-card/70 border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            Bank Sync
          </button>
        </div>
      </div>

      {/* Main List Area */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs sm:text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
          <p className="text-sm font-semibold text-destructive">Failed to load notifications</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-1.5 text-xs font-medium rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <NotificationEmptyState filterType={activeTab} />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkAsRead={(id) => markAsReadMutation.mutate(id)}
              isMarkingRead={markAsReadMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted/70 text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted/70 text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />
    </div>
  );
}
