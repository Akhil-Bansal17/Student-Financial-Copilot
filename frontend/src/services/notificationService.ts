import { apiClient } from './apiClient';
import type {
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
  NotificationPreference,
  NotificationPreferenceUpdate,
  AlertEvaluationResult,
} from '@/types/notification';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters?: { isRead?: boolean; priority?: string; page?: number; pageSize?: number }) =>
    ['notifications', 'list', filters || {}] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  preferences: () => ['notifications', 'preferences'] as const,
};

export const notificationService = {
  async getNotifications(params?: {
    isRead?: boolean;
    priority?: string;
    page?: number;
    pageSize?: number;
  }): Promise<NotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.isRead !== undefined) {
      searchParams.set('is_read', String(params.isRead));
    }
    if (params?.priority) {
      searchParams.set('priority', params.priority);
    }
    if (params?.page) {
      searchParams.set('page', String(params.page));
    }
    if (params?.pageSize) {
      searchParams.set('page_size', String(params.pageSize));
    }

    const qs = searchParams.toString();
    const endpoint = qs ? `/api/v1/notifications?${qs}` : '/api/v1/notifications';
    return apiClient<NotificationListResponse>(endpoint);
  },

  async getUnreadCount(): Promise<UnreadCountResponse> {
    return apiClient<UnreadCountResponse>('/api/v1/notifications/unread-count');
  },

  async markAsRead(notificationId: number): Promise<NotificationItem> {
    return apiClient<NotificationItem>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  async markAllAsRead(): Promise<{ marked_count: number; message: string }> {
    return apiClient<{ marked_count: number; message: string }>('/api/v1/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  async evaluateAlerts(): Promise<AlertEvaluationResult> {
    return apiClient<AlertEvaluationResult>('/api/v1/notifications/evaluate', {
      method: 'POST',
    });
  },

  async getPreferences(): Promise<NotificationPreference> {
    return apiClient<NotificationPreference>('/api/v1/notification-preferences');
  },

  async updatePreferences(data: NotificationPreferenceUpdate): Promise<NotificationPreference> {
    return apiClient<NotificationPreference>('/api/v1/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
