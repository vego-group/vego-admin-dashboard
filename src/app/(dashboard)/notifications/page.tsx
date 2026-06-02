'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  BatteryLow,
  Zap,
  Bike,
  WifiOff,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotificationStore } from '@/store/notifications';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Notification, NotificationType } from '@/types';

/* ── Type config ─────────────────────────────────── */

const TYPE_CFG: Record<
  NotificationType,
  {
    Icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    badgeCls: string;
    labelKey: 'typeAlert' | 'typeWarning' | 'typeSuccess' | 'typeInfo' | 'typeError';
  }
> = {
  alert: {
    Icon: BatteryLow,
    iconBg: 'bg-orange-100 dark:bg-orange-500/15',
    iconColor: 'text-orange-500',
    badgeCls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    labelKey: 'typeAlert',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-100 dark:bg-amber-500/15',
    iconColor: 'text-amber-500',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    labelKey: 'typeWarning',
  },
  success: {
    Icon: Zap,
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    labelKey: 'typeSuccess',
  },
  info: {
    Icon: Bike,
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/15',
    iconColor: 'text-indigo-500',
    badgeCls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
    labelKey: 'typeInfo',
  },
  error: {
    Icon: WifiOff,
    iconBg: 'bg-red-100 dark:bg-red-500/15',
    iconColor: 'text-red-500',
    badgeCls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    labelKey: 'typeError',
  },
};

/* ── Time helper ─────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/* ── Filter tabs ─────────────────────────────────── */

type FilterTab = 'all' | 'unread' | 'alert' | 'warning' | 'success';

/* ── Page ────────────────────────────────────────── */

export default function NotificationsPage() {
  const { t } = useI18n();
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, remove, clearAll } =
    useNotificationStore();
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => { void fetchNotifications(); }, [fetchNotifications]);

  const stats = useMemo(
    () => ({
      total:   notifications.length,
      success: notifications.filter((n) => n.type === 'success').length,
      warning: notifications.filter((n) => n.type === 'warning').length,
      alert:   notifications.filter((n) => n.type === 'alert').length,
      error:   notifications.filter((n) => n.type === 'error').length,
    }),
    [notifications]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':  return notifications.filter((n) => !n.read);
      case 'alert':   return notifications.filter((n) => n.type === 'alert');
      case 'warning': return notifications.filter((n) => n.type === 'warning');
      case 'success': return notifications.filter((n) => n.type === 'success');
      default:        return notifications;
    }
  }, [notifications, filter]);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all',     label: t('notifications.all') },
    { key: 'unread',  label: t('notifications.unread') },
    { key: 'alert',   label: t('notifications.alerts') },
    { key: 'warning', label: t('notifications.warnings') },
    { key: 'success', label: t('notifications.success') },
  ];

  return (
    <DashboardShell
      title={t('notifications.title')}
      subtitle={t('notifications.subtitle')}
    >
      {/* ── Stat cards ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <StatCard
          icon={<Bell className="h-5 w-5" />}
          label={t('notifications.total')}
          count={stats.total}
          cardCls="bg-blue-50/70 dark:bg-blue-500/10"
          iconCls="bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t('notifications.success')}
          count={stats.success}
          cardCls="bg-emerald-50/70 dark:bg-emerald-500/10"
          iconCls="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label={t('notifications.warnings')}
          count={stats.warning}
          cardCls="bg-amber-50/70 dark:bg-amber-500/10"
          iconCls="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
        />
        <StatCard
          icon={<AlertOctagon className="h-5 w-5" />}
          label={t('notifications.alerts')}
          count={stats.alert}
          cardCls="bg-orange-50/70 dark:bg-orange-500/10"
          iconCls="bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label={t('notifications.errors')}
          count={stats.error}
          cardCls="bg-red-50/70 dark:bg-red-500/10"
          iconCls="bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
        />
      </div>

      {/* ── Filter + actions row ──────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Tabs — horizontally scrollable on small screens */}
        <div className="min-w-0 overflow-x-auto">
          <div
            className="flex w-max items-center gap-1 rounded-xl border bg-slate-50/60 p-1 dark:bg-slate-900/40"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                filter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              {tab.label}
              {tab.key === 'unread' && unreadCount > 0 && (
                <span className="ms-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <Check className="h-3.5 w-3.5" />
            {t('notifications.markAllRead')}
          </button>
          <button
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-500/10"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('notifications.clearAll')}
          </button>
        </div>
      </div>

      {/* ── Notification list ─────────────────────── */}
      <Card className="mt-4 divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={markAsRead}
              onDelete={remove}
            />
          ))
        )}
      </Card>
    </DashboardShell>
  );
}

/* ── Stat card ───────────────────────────────────── */

function StatCard({
  icon,
  label,
  count,
  cardCls,
  iconCls,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  cardCls: string;
  iconCls: string;
}) {
  return (
    <Card className={cn('flex items-center gap-3 p-4', cardCls)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconCls)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{count}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  );
}

/* ── Notification item ───────────────────────────── */

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const cfg = TYPE_CFG[notification.type];
  const { Icon } = cfg;

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
        !notification.read && 'bg-brand-50/40 dark:bg-brand-500/5'
      )}
    >
      {/* Type icon */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          cfg.iconBg
        )}
      >
        <Icon className={cn('h-5 w-5', cfg.iconColor)} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {notification.title}
          </h3>
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
            {timeAgo(notification.createdAt)}
          </span>
        </div>

        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {notification.description}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          {/* Badges */}
          <div className="flex items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.badgeCls)}>
              {t(`notifications.${cfg.labelKey}`)}
            </span>
            {!notification.read && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {t('notifications.newBadge')}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!notification.read && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <Check className="h-3 w-3" />
                {t('notifications.markRead')}
              </button>
            )}
            <button
              onClick={() => onDelete(notification.id)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
