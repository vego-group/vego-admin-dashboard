import { create } from 'zustand';
import { notificationsApi } from '@/lib/api';
import type { Notification } from '@/types';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  /** Fetch (or re-fetch) all notifications from the backend. */
  fetchNotifications: () => Promise<void>;
  /** Lightweight poll — only fetches the unread count (for sidebar badge). */
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const notifications = await notificationsApi.list();
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Non-fatal — badge just won't update
    }
  },

  markAsRead: async (id) => {
    // Optimistic update
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
    try {
      await notificationsApi.markRead(id);
    } catch {
      // revert on failure
      await get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await notificationsApi.markAllRead();
    } catch {
      await get().fetchNotifications();
    }
  },

  remove: async (id) => {
    // Optimistic update
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
    try {
      await notificationsApi.remove(id);
    } catch {
      await get().fetchNotifications();
    }
  },

  clearAll: async () => {
    // Optimistic update
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationsApi.clearAll();
    } catch {
      await get().fetchNotifications();
    }
  },
}));
