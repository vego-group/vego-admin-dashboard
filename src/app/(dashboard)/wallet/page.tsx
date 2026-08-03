'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, ShoppingCart, Users2,
  Download, CheckCircle2, Clock, XCircle,
  ArrowUp, AlertTriangle, Calendar,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import { useFleetContext } from '@/hooks/useFleetContext';
import { apiTransactionType, driversApi, walletApi } from '@/lib/api';
import { fractionDigitsOf, fromMinorUnits, toMinorUnits } from '@/lib/money';
import type {
  CurrencyCode, Driver, TransactionType, TransactionStatus, WalletTransaction, WalletStats,
} from '@/types';
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
  d.setMonth(d.getMonth() - 2);
  d.setDate(1);
  return isoDate(d);
}
function defaultTo(): string { return isoDate(new Date()); }

// ── CSV export ────────────────────────────────────────────────────────────

/**
 * The signed amount, at the precision the value actually has.
 *
 * `toFixed(2)` was wrong twice over in Jordan: it labelled JOD as SAR and it
 * truncated the third decimal, so an exported "1.234" became "1.23" and a
 * reconciled total drifted. The exact decimal string the backend sent is
 * preferred; the fleet's own decimals are the fallback for rows that predate the
 * money object.
 *
 * The **sign comes from `direction`**, never from the characters of the amount.
 * Debits arrive positive (`type: "debit"`), so the old `startsWith('-')` test
 * exported every single row with a leading `+` and a reconciliation against the
 * export added spending to the balance instead of subtracting it.
 */
function csvAmount(tx: WalletTransaction, fleetDecimals: number | null): string {
  const decimals = tx.money?.decimals ?? fleetDecimals ?? fractionDigitsOf(tx.amount);
  // The backend's own signed string first; then the exact magnitude; then a
  // reconstruction for rows that predate the money object.
  const source = tx.signedAmount
    || tx.money?.amount
    || fromMinorUnits(toMinorUnits(tx.amount, decimals), decimals);
  return `${tx.direction === 'out' ? '-' : '+'}${source.replace(/^[+-]/, '')}`;
}

function exportCsv(
  rows: WalletTransaction[],
  currency: CurrencyCode | null,
  decimals: number | null,
) {
  // The header names the currency only when we actually know it — an unlabelled
  // "Amount" is honest, "Amount (SAR)" on a Jordanian export is not. A per-row
  // Currency column carries the value each transaction was settled in.
  const headers = [
    'Date', 'Driver',
    currency ? `Amount (${currency})` : 'Amount',
    'Currency',
    'Type', 'Payment Method', 'Note', 'Status', 'Admin',
  ];
  const lines = rows.map((r) => [
    formatDT(r.createdAt),
    r.driverName,
    csvAmount(r, decimals),
    r.money?.currency ?? currency ?? '',
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
  const { formatMoney, currency, currencyDecimals } = useFleetContext();

  // Data. `served` is one page straight from the paginator; `walked` is every
  // matching row, used only for the two filters the server cannot express (see
  // the effects below). Exactly one is populated at a time.
  const [served, setServed] = useState<{ rows: WalletTransaction[]; total: number; lastPage: number }>(
    { rows: [], total: 0, lastPage: 1 },
  );
  const [walked, setWalked] = useState<WalletTransaction[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate,   setToDate]   = useState(defaultTo);
  const [driverFilter, setDriverFilter] = useState('all');
  const [typeFilter,   setTypeFilter]   = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  /**
   * The filters the endpoint understands, in its own vocabulary.
   *
   * `from`, `to`, `driver_id` and `status` map one-to-one. `type` does not — see
   * `apiTransactionType`; `typeIsExact` is false for the two debit sub-kinds,
   * which the server can only narrow to `debit`.
   */
  const apiType   = apiTransactionType(typeFilter);
  const exactMode = apiType.exact;
  const query = useMemo(() => ({
    from:     fromDate || undefined,
    to:       toDate   || undefined,
    driverId: driverFilter !== 'all' ? driverFilter : undefined,
    status:   statusFilter !== 'all' ? statusFilter : undefined,
    type:     apiType.param,
  }), [fromDate, toDate, driverFilter, statusFilter, apiType.param]);

  // Stats and the driver roster are filter-independent, so they load once.
  // Crucially the roster comes from the *drivers* endpoint: deriving it from
  // whatever transactions happened to be on screen meant a driver whose activity
  // fell past the cap could not be selected, while the dropdown looked complete.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statsRes, driversRes] = await Promise.allSettled([
        walletApi.getStats(),
        driversApi.list(),
      ]);
      if (cancelled) return;
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      else logger.error('[Wallet] Failed to load stats:', statsRes.reason);
      if (driversRes.status === 'fulfilled') setDrivers(driversRes.value);
      else logger.error('[Wallet] Failed to load drivers for the filter:', driversRes.reason);
    })();
    return () => { cancelled = true; };
  }, []);

  // Anything that changes what should be on screen puts the table back into
  // loading; whichever fetch effect owns the current mode clears it. Declared
  // first so it runs before them.
  useEffect(() => { setDataLoading(true); }, [query, page, exactMode, typeFilter]);

  // Exact mode — the server's filter is exactly ours, so this is true
  // server-side pagination: one page per request, totals from the paginator.
  useEffect(() => {
    if (!exactMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await walletApi.getTransactions({ ...query, perPage: PAGE_SIZE, page });
        if (cancelled) return;
        setServed({ rows: res.rows, total: res.page.total, lastPage: Math.max(1, res.page.lastPage) });
        setTruncated(false);
      } catch (err) {
        if (cancelled) return;
        logger.error('[Wallet] Failed to load transactions:', err);
        setServed({ rows: [], total: 0, lastPage: 1 });
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exactMode, query, page]);

  // Refine mode — 'fast_charge' and 'battery_swap' only exist once
  // `reference_type` is read on this side, so the server can only narrow to
  // `debit`. Walk every matching page once per filter change and refine here;
  // refining one page at a time would silently drop rows the operator asked for.
  // `page` is deliberately not a dependency: paging is a local slice below, not
  // another walk.
  useEffect(() => {
    if (exactMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await walletApi.getAllTransactions(query);
        if (cancelled) return;
        setWalked(res.rows.filter((tx) => tx.type === typeFilter));
        setTruncated(res.truncated);
      } catch (err) {
        if (cancelled) return;
        logger.error('[Wallet] Failed to load transactions:', err);
        setWalked([]);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exactMode, query, typeFilter]);

  const { rows, total, totalPages } = useMemo(() => (
    exactMode
      ? { rows: served.rows, total: served.total, totalPages: served.lastPage }
      : {
          rows:       walked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          total:      walked.length,
          totalPages: Math.max(1, Math.ceil(walked.length / PAGE_SIZE)),
        }
  ), [exactMode, served, walked, page]);

  const driverOptions = useMemo(() => [
    { value: 'all', label: t('wallet.allDrivers') },
    ...drivers.map((d) => ({ value: d.id, label: d.name })),
  ], [drivers, t]);

  /**
   * Export every row matching the current filters — not just the page on screen.
   * Walks the paginator, so the CSV is the ledger rather than a window onto it.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await walletApi.getAllTransactions(query);
      const exportRows = exactMode
        ? res.rows
        : res.rows.filter((tx) => tx.type === typeFilter);
      exportCsv(exportRows, currency, currencyDecimals);
      if (res.truncated) setTruncated(true);
    } catch (err) {
      logger.error('[Wallet] CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  return (
    <DashboardShell title={t('wallet.title')} subtitle={t('wallet.subtitle')}>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('wallet.totalTopUps')}
          value={stats ? formatMoney(stats.totalTopUps, locale) : '—'}
          iconBg="bg-gradient-to-br from-emerald-400 to-emerald-600"
          Icon={TrendingUp}
          trend={stats?.topUpTrend}
          loading={dataLoading}
        />
        <StatCard
          label={t('wallet.totalSpent')}
          value={stats ? formatMoney(stats.totalSpent, locale) : '—'}
          iconBg="bg-gradient-to-br from-rose-400 to-rose-600"
          Icon={ShoppingCart}
          subtitle={stats ? t('wallet.ofBudget', { percent: stats.budgetUsedPercent }) : undefined}
          loading={dataLoading}
        />
        <StatCard
          label={t('wallet.avgPerDriver')}
          value={stats ? formatMoney(stats.avgPerDriver, locale) : '—'}
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

          {/* Export — walks every page, so it exports the ledger, not the view */}
          <div className="w-full sm:ms-auto sm:w-auto">
            <Button
              variant="primary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleExport}
              isLoading={exporting}
              className="w-full sm:w-auto"
            >
              {t('wallet.exportCsv')}
            </Button>
          </div>
        </div>

        {/* A capped result must say so — a short export that looks complete is
            the exact failure this page had. */}
        {truncated && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('wallet.resultTruncated')}
          </p>
        )}
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {t('wallet.noTransactions')}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{t('wallet.noTransactionsHint')}</p>
                  </td>
                </tr>
              ) : (
                rows.map((tx) => {
                  const StatusIcon = STATUS_ICON[tx.status];
                  // Direction, never the sign. A debit is a positive amount with
                  // type "debit" — reading `amount >= 0` painted every debit
                  // green as if it were a credit.
                  const isCredit   = tx.direction === 'in';
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
                        {/* `amount` is a magnitude; the sign is the direction's. */}
                        <span dir="ltr">{isCredit ? '+' : '−'}{formatMoney(tx.amount, locale)}</span>
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

        {total > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"
            style={{ borderColor: 'rgb(var(--border))' }}
          >
            {/* `total` is the paginator's own count across every page, not the
                length of what happens to be loaded. */}
            <p className="text-xs text-slate-500">
              {t('wallet.showing', { count: rows.length, total })}
            </p>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </Card>

    </DashboardShell>
  );
}
