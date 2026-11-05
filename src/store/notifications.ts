import { create } from 'zustand';
import { notificationsApi } from '@/lib/api';
import { isForbiddenError } from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { onAccountChange } from '@/store/auth';
import type { Notification } from '@/types';

interface NotificationStore {
  /** The most recent notifications: one page, not necessarily all of them. */
  notifications: Notification[];
  /** How many there are on the server, when it said; else undefined. */
  total: number | undefined;
  /** True when the server holds more notifications than `notifications` (FA-306). */
  truncated: boolean;
  /** The server's unread count. Never derived from a page that may be partial. */
  unreadCount: number;
  loading: boolean;
  /** The last list fetch was refused with a 403 — "no access", not "no notifications". */
  forbidden: boolean;
  /**
   * Why the last list fetch failed (other than a 403), or undefined. A failure
   * used to leave the list empty, which read as "no notifications" (FA-312).
   */
  loadError: unknown;
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
  total: undefined as number | undefined,
  truncated: false,
  unreadCount: 0,
  loading: false,
  forbidden: false,
  loadError: undefined as unknown,
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
    set({ loading: true, forbidden: false, loadError: undefined });
    try {
      const page = await notificationsApi.list();
      if (requestedIn !== generation) return;
      const notifications = page.rows;
      const truncated = page.total !== undefined
        ? page.total > notifications.length
        : notifications.length >= page.perPage;
      set({
        notifications,
        total: page.total,
        truncated,
        // Counted here only when the page is everything; otherwise the server's
        // count, which covers the notifications this page does not show.
        ...(truncated ? {} : { unreadCount: notifications.filter((n) => !n.read).length }),
        loading: false,
        forbidden: false,
        loadError: undefined,
      });
      if (truncated) void get().fetchUnreadCount();
    } catch (err) {
      if (requestedIn !== generation) return;
      logger.error('[Notifications] Failed to load notifications:', err);
      const forbidden = isForbiddenError(err);
      set({ loading: false, forbidden, loadError: forbidden ? undefined : err });
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
    // Optimistic update. The badge moves by what changed, never recounted from
    // the page, which may not hold every unread notification.
    set((state) => {
      const wasUnread = state.notifications.some((n) => n.id === id && !n.read);
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)) };
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
    // Optimistic update, by difference (see markAsRead).
    set((state) => {
      const wasUnread = state.notifications.some((n) => n.id === id && !n.read);
      const notifications = state.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        total: state.total !== undefined ? Math.max(0, state.total - 1) : undefined,
        unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
      };
    });
    try {
      await notificationsApi.remove(id);
    } catch {
      await get().fetchNotifications();
    }
  },

  clearAll: async () => {
    // Optimistic update
    set({ notifications: [], total: 0, truncated: false, unreadCount: 0 });
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
