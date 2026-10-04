import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { Header } from '@/components/layout/Header';
import { DashboardAlertsCard } from '@/components/notifications/DashboardAlertsCard';
import { NotificationPreferencesModal } from '@/components/notifications/NotificationPreferencesModal';
import { notificationService } from '@/services/notificationService';
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationPreference,
  UnreadCountResponse,
} from '@/types/notification';

const mockNotifications: NotificationItem[] = [
  {
    id: 1,
    user_id: 1,
    notification_type: 'FORECAST_LOW_BUFFER',
    priority: 'CRITICAL',
    title: 'Forecast Buffer Warning',
    message: 'Your projected balance may fall below your ₹2,000 minimum safety buffer on 18 Oct.',
    entity_type: 'forecast',
    entity_id: null,
    action_url: '/forecast',
    dedupe_key: 'forecast_low_buffer:1:2026-10-18',
    is_read: false,
    read_at: null,
    created_at: '2026-10-04T10:00:00Z',
    expires_at: '2026-10-25T00:00:00Z',
    metadata_json: { projected_balance: '1200.00', date: '2026-10-18' },
  },
  {
    id: 2,
    user_id: 1,
    notification_type: 'BUDGET_EXCEEDED',
    priority: 'HIGH',
    title: 'Budget Limit Exceeded',
    message: 'Food & Dining has reached ₹3,500 of your ₹3,000 monthly limit (116.7%).',
    entity_type: 'budget',
    entity_id: '5',
    action_url: '/budgets',
    dedupe_key: 'budget_exceeded:1:5:2026:10',
    is_read: false,
    read_at: null,
    created_at: '2026-10-04T09:00:00Z',
    expires_at: null,
    metadata_json: { category: 'Food & Dining', spent: '3500.00', limit: '3000.00' },
  },
  {
    id: 3,
    user_id: 1,
    notification_type: 'GOAL_MILESTONE',
    priority: 'INFO',
    title: 'Goal Milestone Achieved',
    message: 'Congratulations! You have reached 50% of your Laptop Fund goal.',
    entity_type: 'goal',
    entity_id: '2',
    action_url: '/goals',
    dedupe_key: 'goal_milestone:1:2:50',
    is_read: true,
    read_at: '2026-10-04T09:30:00Z',
    created_at: '2026-10-03T14:00:00Z',
    expires_at: null,
    metadata_json: { goal_name: 'Laptop Fund', milestone: 50 },
  },
];

const mockListResponse: NotificationListResponse = {
  items: mockNotifications,
  total_count: 3,
  page: 1,
  page_size: 20,
  total_pages: 1,
  unread_count: 2,
};

const mockUnreadData: UnreadCountResponse = {
  unread_count: 2,
  critical_count: 1,
  high_count: 1,
};

const mockPreferences: NotificationPreference = {
  id: 1,
  user_id: 1,
  smart_alerts_enabled: true,
  forecast_alerts_enabled: true,
  budget_alerts_enabled: true,
  goal_alerts_enabled: true,
  recurring_alerts_enabled: true,
  bank_alerts_enabled: true,
  spending_alerts_enabled: true,
  positive_alerts_enabled: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Phase 15 — Notifications & Alerts Center', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Header Notification Bell', () => {
    it('renders notification bell with live unread badge and accessible label', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);

      renderWithClient(<Header title="Dashboard" />);

      // Wait for badge to appear
      await waitFor(() => {
        const bellLink = screen.getByRole('link', { name: /Notifications, 2 unread/i });
        expect(bellLink).toBeInTheDocument();
        expect(bellLink).toHaveAttribute('href', '/notifications');
      });

      // The unread badge number 2 should be displayed
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders neutral aria-label when there are 0 unread notifications', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
        unread_count: 0,
        critical_count: 0,
        high_count: 0,
      });

      renderWithClient(<Header title="Dashboard" />);

      await waitFor(() => {
        const bellLink = screen.getByRole('link', { name: 'Notifications' });
        expect(bellLink).toBeInTheDocument();
      });

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('NotificationsPage Rendering & Interactions', () => {
    it('renders notification list with priority badges, titles, and messages', async () => {
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(mockListResponse);
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);

      renderWithClient(<NotificationsPage />);

      // Wait for notifications to load
      await screen.findByText('Forecast Buffer Warning');

      expect(screen.getByRole('heading', { level: 1, name: /Notifications/i })).toBeInTheDocument();
      expect(screen.getByText(/Your projected balance may fall below/i)).toBeInTheDocument();
      expect(screen.getByText('Budget Limit Exceeded')).toBeInTheDocument();
      expect(screen.getByText('Goal Milestone Achieved')).toBeInTheDocument();

      // Check priority badges
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('INFO')).toBeInTheDocument();

      // Check action buttons exist
      const detailsButtons = screen.getAllByRole('button', { name: /View details/i });
      expect(detailsButtons.length).toBeGreaterThan(0);
    });

    it('allows marking a single notification as read', async () => {
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(mockListResponse);
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);
      const markSpy = vi.spyOn(notificationService, 'markAsRead').mockResolvedValue({
        ...mockNotifications[0],
        is_read: true,
        read_at: '2026-10-04T12:00:00Z',
      });

      renderWithClient(<NotificationsPage />);

      await waitFor(() => {
        expect(screen.getByText('Forecast Buffer Warning')).toBeInTheDocument();
      });

      // Find the mark as read button on the first notification
      const markReadButtons = screen.getAllByRole('button', { name: /Mark read/i });
      expect(markReadButtons.length).toBeGreaterThan(0);
      fireEvent.click(markReadButtons[0]);

      await waitFor(() => {
        expect(markSpy).toHaveBeenCalledWith(1);
      });
    });

    it('allows marking all notifications as read', async () => {
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(mockListResponse);
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);
      const markAllSpy = vi.spyOn(notificationService, 'markAllAsRead').mockResolvedValue({
        marked_count: 2,
        message: 'All notifications marked as read',
      });

      renderWithClient(<NotificationsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Mark all read/i })).toBeInTheDocument();
      });

      const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(markAllSpy).toHaveBeenCalled();
      });
    });

    it('switches between All and Unread filter tabs', async () => {
      const getNotifSpy = vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(mockListResponse);
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);

      renderWithClient(<NotificationsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Unread/i })).toBeInTheDocument();
      });

      const unreadTab = screen.getByRole('button', { name: /Unread/i });
      fireEvent.click(unreadTab);

      await waitFor(() => {
        expect(getNotifSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            isRead: false,
          })
        );
      });
    });

    it('displays empty state when there are no notifications', async () => {
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue({
        items: [],
        total_count: 0,
        page: 1,
        page_size: 20,
        total_pages: 1,
        unread_count: 0,
      });
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
        unread_count: 0,
        critical_count: 0,
        high_count: 0,
      });

      renderWithClient(<NotificationsPage />);

      await waitFor(() => {
        expect(screen.getByText('No Notifications')).toBeInTheDocument();
      });
      expect(screen.getByText(/You will receive intelligent alerts here/i)).toBeInTheDocument();
    });
  });

  describe('NotificationPreferencesModal', () => {
    it('renders preferences modal and allows updating category toggles', async () => {
      vi.spyOn(notificationService, 'getPreferences').mockResolvedValue(mockPreferences);
      const updateSpy = vi.spyOn(notificationService, 'updatePreferences').mockResolvedValue({
        ...mockPreferences,
        budget_alerts_enabled: false,
      });

      const onClose = vi.fn();
      renderWithClient(<NotificationPreferencesModal isOpen={true} onClose={onClose} />);

      // Wait for preferences query to resolve and content to render
      await screen.findByText('Smart Alerts Master Switch');

      expect(screen.getByText('Alert Preferences')).toBeInTheDocument();
      expect(screen.getByText('Cash Flow Forecast Alerts')).toBeInTheDocument();
      expect(screen.getByText('Budget Spending Limits')).toBeInTheDocument();
      expect(screen.getByText('Savings Goal Milestones')).toBeInTheDocument();
      expect(screen.getByText('Recurring Bills & Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Bank Synchronization Alerts')).toBeInTheDocument();
      expect(screen.getByText('Spending Pattern Shifts')).toBeInTheDocument();
      expect(screen.getByText('Positive Progress Signals')).toBeInTheDocument();

      // Find the toggle for Budget Limits and click it
      const budgetToggle = screen.getByRole('checkbox', { name: /Budget Spending Limits toggle/i });
      fireEvent.click(budgetToggle);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            budget_alerts_enabled: false,
          })
        );
      });
    });
  });

  describe('DashboardAlertsCard', () => {
    it('renders compact alert banner on Dashboard when unread alerts exist', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(mockUnreadData);
      vi.spyOn(notificationService, 'getNotifications').mockResolvedValue(mockListResponse);

      renderWithClient(<DashboardAlertsCard />);

      // Wait for both unread query and top alert query to resolve
      await screen.findByText('Forecast Buffer Warning');

      expect(screen.getByText('2 alerts need your attention')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View all/i })).toBeInTheDocument();
    });

    it('renders nothing when unread count is zero', async () => {
      vi.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
        unread_count: 0,
        critical_count: 0,
        high_count: 0,
      });

      const { container } = renderWithClient(<DashboardAlertsCard />);

      await waitFor(() => {
        expect(container).toBeEmptyDOMElement();
      });
    });
  });
});
