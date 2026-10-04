import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Bell, Calendar, Wallet, Target, RefreshCw, Landmark, TrendingUp, Sparkles, Check, Loader2 } from 'lucide-react';
import { notificationService, notificationKeys } from '@/services/notificationService';
import type { NotificationPreferenceUpdate } from '@/types/notification';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationService.getPreferences(),
    enabled: isOpen,
  });

  const [localOverrides, setLocalOverrides] = useState<NotificationPreferenceUpdate>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const formState: NotificationPreferenceUpdate = {
    smart_alerts_enabled: localOverrides.smart_alerts_enabled ?? preferences?.smart_alerts_enabled ?? true,
    forecast_alerts_enabled: localOverrides.forecast_alerts_enabled ?? preferences?.forecast_alerts_enabled ?? true,
    budget_alerts_enabled: localOverrides.budget_alerts_enabled ?? preferences?.budget_alerts_enabled ?? true,
    goal_alerts_enabled: localOverrides.goal_alerts_enabled ?? preferences?.goal_alerts_enabled ?? true,
    recurring_alerts_enabled: localOverrides.recurring_alerts_enabled ?? preferences?.recurring_alerts_enabled ?? true,
    bank_alerts_enabled: localOverrides.bank_alerts_enabled ?? preferences?.bank_alerts_enabled ?? true,
    spending_alerts_enabled: localOverrides.spending_alerts_enabled ?? preferences?.spending_alerts_enabled ?? true,
    positive_alerts_enabled: localOverrides.positive_alerts_enabled ?? preferences?.positive_alerts_enabled ?? true,
  };

  const updateMutation = useMutation({
    mutationFn: (updates: NotificationPreferenceUpdate) => notificationService.updatePreferences(updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationKeys.preferences(), updated);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  if (!isOpen) return null;

  const handleToggle = (key: keyof NotificationPreferenceUpdate) => {
    const nextVal = !formState[key];
    setLocalOverrides((prev) => ({ ...prev, [key]: nextVal }));
    updateMutation.mutate({ [key]: nextVal });
  };

  const categories = [
    {
      key: 'forecast_alerts_enabled' as const,
      label: 'Cash Flow Forecast Alerts',
      description: 'Warnings when projected balances dip below your safety buffer or become negative.',
      icon: <Calendar className="h-4 w-4 text-indigo-500" />,
    },
    {
      key: 'budget_alerts_enabled' as const,
      label: 'Budget Spending Limits',
      description: 'Alerts when monthly category or overall spending reaches 80% or exceeds budget.',
      icon: <Wallet className="h-4 w-4 text-purple-500" />,
    },
    {
      key: 'goal_alerts_enabled' as const,
      label: 'Savings Goal Milestones',
      description: 'Celebrations for 25%, 50%, 75%, and 100% completion, plus overdue notices.',
      icon: <Target className="h-4 w-4 text-emerald-500" />,
    },
    {
      key: 'recurring_alerts_enabled' as const,
      label: 'Recurring Bills & Subscriptions',
      description: 'Upcoming renewal reminders (3 days ahead), missed charges, and price shifts.',
      icon: <RefreshCw className="h-4 w-4 text-cyan-500" />,
    },
    {
      key: 'bank_alerts_enabled' as const,
      label: 'Bank Synchronization Alerts',
      description: 'Notices when connected Account Aggregator accounts are stale or fail to refresh.',
      icon: <Landmark className="h-4 w-4 text-sky-500" />,
    },
    {
      key: 'spending_alerts_enabled' as const,
      label: 'Spending Pattern Shifts',
      description: 'Insights on high month-over-month growth and concentrated category spend.',
      icon: <TrendingUp className="h-4 w-4 text-orange-500" />,
    },
    {
      key: 'positive_alerts_enabled' as const,
      label: 'Positive Progress Signals',
      description: 'Encouraging updates when your budget pacing and savings buffer remain strong.',
      icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">Alert Preferences</h2>
              <p className="text-xs text-muted-foreground">Manage which in-app financial notices you receive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading preferences...</p>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* Global Master Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/80">
              <div>
                <p className="text-sm font-semibold text-foreground">Smart Alerts Master Switch</p>
                <p className="text-xs text-muted-foreground">Enable or pause all automated smart notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Smart Alerts Master Switch toggle"
                  className="sr-only peer"
                  checked={formState.smart_alerts_enabled ?? true}
                  onChange={() => handleToggle('smart_alerts_enabled')}
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
              </label>
            </div>

            {/* Category Toggles */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Alert Categories
              </h4>
              <div className="space-y-2.5">
                {categories.map((cat) => {
                  const isChecked = formState[cat.key] ?? true;
                  const isMasterDisabled = formState.smart_alerts_enabled === false;

                  return (
                    <div
                      key={cat.key}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-colors ${
                        isMasterDisabled
                          ? 'opacity-50 border-border/40 bg-card/30'
                          : 'border-border/80 bg-card/60 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start space-x-3 pr-3">
                        <div className="mt-0.5 rounded-lg bg-muted/60 p-2 shrink-0">{cat.icon}</div>
                        <div>
                          <p className="text-xs sm:text-sm font-medium text-foreground">{cat.label}</p>
                          <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          aria-label={`${cat.label} toggle`}
                          disabled={isMasterDisabled}
                          className="sr-only peer"
                          checked={isChecked}
                          onChange={() => handleToggle(cat.key)}
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {saveSuccess && (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="h-4 w-4" />
                <span>Preferences saved automatically</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
