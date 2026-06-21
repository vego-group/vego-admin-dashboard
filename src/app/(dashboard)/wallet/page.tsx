'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, ShoppingCart, Users2,
  Download, CheckCircle2, Clock, XCircle,
  ArrowUp, Calendar,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { walletApi } from '@/lib/api';
import type { TransactionType, TransactionStatus, WalletTransaction, WalletStats } from '@/types';
import { logger } from '@/lib/logger';

const PAGE_SIZE = 8;

// ── Config maps ───────────────────────────────────────────────────────────

const TYPE_CLASS: Record<TransactionType, string> = {
  top_up:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  fast_charge:  'bg-blue-100   text-blue-700   dark:bg-blue-500/15   dark:text-blue-400',
  battery_swap: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  refund:       'bg-amber-100  text-amber-700  dark:bg-amber-500/15  dark:text-amber-400',
};

const TYPE_I18N: Record<TransactionType, string> = {
  top_up:       'wallet.typeTopUp',
  fast_charge:  'wallet.typeFastCharge',
  battery_swap: 'wallet.typeBatterySwap',
  refund:       'wallet.typeRefund',
};

const STATUS_ICON: Record<TransactionStatus, React.ElementType> = {
  completed: CheckCircle2,
  pending:   Clock,
  failed:    XCircle,
  cancelled: XCircle,
};

const STATUS_CLASS: Record<TransactionStatus, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  pending:   'text-amber-600   dark:text-amber-400',
  failed:    'text-rose-600    dark:text-rose-400',
  cancelled: 'text-slate-500   dark:text-slate-400',
};

const STATUS_I18N: Record<TransactionStatus, string> = {
  completed: 'wallet.statusCompleted',
  pending:   'wallet.statusPending',
  failed:    'wallet.statusFailed',
  cancelled: 'wallet.statusCancelled',
};

// ── Date helpers ──────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDT(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(1);
  return isoDate(d);
}
function defaultTo(): string { return isoDate(new Date()); }

// ── CSV export ────────────────────────────────────────────────────────────

function exportCsv(rows: WalletTransaction[]) {
  const headers = ['Date', 'Driver', 'Amount (SAR)', 'Type', 'Payment Method', 'Note', 'Status', 'Admin'];
  const lines = rows.map((r) => [
    formatDT(r.createdAt),
    r.driverName,
    r.amount >= 0 ? `+${r.amount.toFixed(2)}` : `${r.amount.toFixed(2)}`,
    r.type,
    r.paymentMethod ?? '',
    r.note ?? '',
    r.status,
    r.adminName ?? '',
  ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'wallet-transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit, subtitle, trend, iconBg, Icon, loading,
}: {
  label: string;
  value: string;
  unit?: string;
  subtitle?: React.ReactNode;
  trend?: number;
  iconBg: string;
  Icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {loading ? (
            <>
              <Skeleton className="mt-2 h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </>
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[28px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
                  {value}
                </span>
                {unit && (
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>
                )}
              </div>
              {trend !== undefined && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <ArrowUp className="h-3 w-3" />
                  +{trend}%
                </div>
              )}
              {subtitle && (
                <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { t, locale } = useI18n();

  // Data
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate,   setToDate]   = useState(defaultTo);
  const [driverFilter, setDriverFilter] = useState('all');
  const [typeFilter,   setTypeFilter]   = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [txns, walletStats] = await Promise.all([
          walletApi.getTransactions({ perPage: 200 }),
          walletApi.getStats(),
        ]);
        if (!cancelled) {
          setAllTransactions(txns);
          setStats(walletStats);
        }
      } catch (err) {
        logger.error('[Wallet] Failed to load data:', err);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Unique driver options derived from fetched transactions
  const driverOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: t('wallet.allDrivers') }];
    allTransactions.forEach((tx) => {
      if (!seen.has(tx.driverId)) {
        seen.add(tx.driverId);
        opts.push({ value: tx.driverId, label: tx.driverName });
      }
    });
    return opts;
  }, [allTransactions, t]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return allTransactions.filter((tx) => {
      const txDate = tx.createdAt.split('T')[0];
      if (fromDate && txDate < fromDate) return false;
      if (toDate   && txDate > toDate)   return false;
      if (driverFilter !== 'all' && tx.driverId !== driverFilter) return false;
      if (typeFilter   !== 'all' && tx.type     !== typeFilter)   return false;
      if (statusFilter !== 'all' && tx.status   !== statusFilter) return false;
      return true;
    });
  }, [allTransactions, fromDate, toDate, driverFilter, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setFilter  = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <DashboardShell title={t('wallet.title')} subtitle={t('wallet.subtitle')}>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('wallet.totalTopUps')}
          value={stats ? formatCurrency(stats.totalTopUps, locale) : '—'}
          iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
          Icon={TrendingUp}
          trend={stats?.topUpTrend}
          loading={dataLoading}
        />
        <StatCard
          label={t('wallet.totalSpent')}
          value={stats ? formatCurrency(stats.totalSpent, locale) : '—'}
          iconBg="bg-gradient-to-br from-rose-400 to-rose-600"
          Icon={ShoppingCart}
          subtitle={stats ? t('wallet.ofBudget', { percent: stats.budgetUsedPercent }) : undefined}
          loading={dataLoading}
        />
        <StatCard
          label={t('wallet.avgPerDriver')}
          value={stats ? formatCurrency(stats.avgPerDriver, locale) : '—'}
          iconBg="bg-gradient-to-br from-indigo-500 to-violet-600"
          Icon={Users2}
          subtitle={stats ? t('wallet.acrossDrivers', { count: stats.activeDriversCount }) : undefined}
          loading={dataLoading}
        />
      </div>

      {/* ── Filters bar ───────────────────────────────────────────────── */}
      <Card className="mt-5 p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">

          {/* Date range */}
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:w-auto">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">{t('wallet.fromDate')}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFilter(setFromDate)(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-white ps-9 pe-3 text-sm text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900/40 dark:text-slate-200"
                  style={{ borderColor: 'rgb(var(--border))' }}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">{t('wallet.toDate')}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setFilter(setToDate)(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-white ps-9 pe-3 text-sm text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900/40 dark:text-slate-200"
                  style={{ borderColor: 'rgb(var(--border))' }}
                />
              </div>
            </div>
          </div>

          {/* Driver */}
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">{t('wallet.driver')}</label>
            <Select
              value={driverFilter}
              onChange={(e) => setFilter(setDriverFilter)(e.target.value)}
              options={driverOptions}
              className="w-full"
            />
          </div>

          {/* Type */}
          <div className="w-full sm:w-auto sm:min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">{t('wallet.type')}</label>
            <Select
              value={typeFilter}
              onChange={(e) => setFilter(setTypeFilter)(e.target.value as TransactionType | 'all')}
              options={[
                { value: 'all',          label: t('wallet.allTypes') },
                { value: 'top_up',       label: t('wallet.typeTopUp') },
                { value: 'fast_charge',  label: t('wallet.typeFastCharge') },
                { value: 'battery_swap', label: t('wallet.typeBatterySwap') },
                { value: 'refund',       label: t('wallet.typeRefund') },
              ]}
              className="w-full"
            />
          </div>

          {/* Status */}
          <div className="w-full sm:w-auto sm:min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-500">{t('wallet.status')}</label>
            <Select
              value={statusFilter}
              onChange={(e) => setFilter(setStatusFilter)(e.target.value as TransactionStatus | 'all')}
              options={[
                { value: 'all',       label: t('wallet.allStatuses') },
                { value: 'completed', label: t('wallet.statusCompleted') },
                { value: 'pending',   label: t('wallet.statusPending') },
                { value: 'failed',    label: t('wallet.statusFailed') },
                { value: 'cancelled', label: t('wallet.statusCancelled') },
              ]}
              className="w-full"
            />
          </div>

          {/* Export */}
          <div className="w-full sm:ms-auto sm:w-auto">
            <Button
              variant="primary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => exportCsv(filtered)}
              className="w-full sm:w-auto"
            >
              {t('wallet.exportCsv')}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Transaction table ─────────────────────────────────────────── */}
      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <th className="px-5 py-4">{t('wallet.date')}</th>
                <th className="px-5 py-4">{t('wallet.driver')}</th>
                <th className="px-5 py-4">{t('wallet.amount')}</th>
                <th className="px-5 py-4">{t('wallet.type')}</th>
                <th className="px-5 py-4">{t('wallet.paymentMethod')}</th>
                <th className="px-5 py-4">{t('wallet.note')}</th>
                <th className="px-5 py-4">{t('wallet.status')}</th>
                <th className="px-5 py-4">{t('wallet.admin')}</th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {t('wallet.noTransactions')}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{t('wallet.noTransactionsHint')}</p>
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => {
                  const StatusIcon = STATUS_ICON[tx.status];
                  const isCredit   = tx.amount >= 0;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      style={{ borderColor: 'rgb(var(--border))' }}
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                        {formatDT(tx.createdAt)}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {tx.driverName}
                      </td>
                      <td className={cn(
                        'px-5 py-4 font-bold tabular-nums',
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                      )}>
                        {isCredit ? '+' : ''}
                        {formatCurrency(tx.amount, locale)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                          TYPE_CLASS[tx.type],
                        )}>
                          {t(TYPE_I18N[tx.type])}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {tx.paymentMethod ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-4 italic text-slate-500 dark:text-slate-400">
                        {tx.note ?? <span className="not-italic text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className={cn('inline-flex items-center gap-1.5 text-sm font-medium', STATUS_CLASS[tx.status])}>
                          <StatusIcon className="h-4 w-4" />
                          {t(STATUS_I18N[tx.status])}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {tx.adminName ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            <p className="text-xs text-slate-500">
              {t('wallet.showing', {
                count: Math.min(paginated.length, PAGE_SIZE),
                total: filtered.length,
              })}
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </Card>

    </DashboardShell>
  );
}
