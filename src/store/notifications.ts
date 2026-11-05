import { create } from 'zustand';
import { notificationsApi } from '@/lib/api';
import { isForbiddenError } from '@/lib/api-errors';
import { onAccountChange } from '@/store/auth';
import type { Notification } from '@/types';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  /** The last list fetch was refused with a 403 — "no access", not "no notifications". */
  forbidden: boolean;
  /** Fetch (or re-fetch) all notifications from the backend. */
  fetchNotifications: () => Promise<void>;
  /** Lightweight poll — only fetches the unread count (for sidebar badge). */
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /** Forget everything fetched for the signed-in account. */
  reset: () => void;
}

const initialState = {
  notifications: [] as Notification[],
  unreadCount: 0,
  loading: false,
  forbidden: false,
};

/**
 * Bumped by every reset. An answer to a request sent before the reset belongs
 * to the account that has just signed out, and is dropped.
 */
let generation = 0;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  ...initialState,

  fetchNotifications: async () => {
    const requestedIn = generation;
    set({ loading: true, forbidden: false });
    try {
      const notifications = await notificationsApi.list();
      if (requestedIn !== generation) return;
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        loading: false,
        forbidden: false,
      });
    } catch (err) {
      if (requestedIn !== generation) return;
      set({ loading: false, forbidden: isForbiddenError(err) });
    }
  },

  fetchUnreadCount: async () => {
    const requestedIn = generation;
    try {
      const count = await notificationsApi.getUnreadCount();
      if (requestedIn !== generation) return;
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

  reset: () => {
    generation += 1;
    set({ ...initialState });
  },
}));

// The list and the unread badge are the signed-in account's. The auth store
// clears them at the session boundary, so the next account in the same tab
// never sees this one's notifications or count (FA-001).
onAccountChange(() => useNotificationStore.getState().reset());
