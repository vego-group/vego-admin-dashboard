'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Plane, UserX, DollarSign, Search } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { DriversTable } from '@/components/drivers/DriversTable';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Pagination } from '@/components/ui/Pagination';
import { useI18n } from '@/i18n/I18nProvider';
import { driversApi } from '@/lib/api';
import type { Driver, DriverStatus } from '@/types';

type TabValue = 'all' | DriverStatus;

export default function DriversPage() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await driversApi.list();
      if (!cancelled) {
        setDrivers(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let result = drivers;
    if (tab !== 'all') result = result.filter((d) => d.status === tab);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [drivers, tab, query]);

  return (
    <DashboardShell title="Driver Management" subtitle={t('drivers.subtitle')}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t('drivers.activeDrivers')}
          value={120}
          icon={<Bike className="h-5 w-5" />}
          iconColor="indigo"
        />
        <MetricCard
          label={t('drivers.onLeave')}
          value={35}
          icon={<Plane className="h-5 w-5" />}
          iconColor="blue"
        />
        <MetricCard
          label={t('drivers.inactive')}
          value={234}
          icon={<UserX className="h-5 w-5" />}
          iconColor="orange"
        />
        <MetricCard
          label={t('drivers.totalCost')}
          value="278.50"
          unit="SAR"
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="violet"
        />
      </div>

      <Card className="mt-5 p-4">
        <SegmentedControl
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'active', label: t('status.active') },
            { value: 'on_leave', label: t('status.onLeave') },
            { value: 'inactive', label: t('status.inactive') },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <Input
              placeholder={t('common.searchByName')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'newest', label: t('common.newestFirst') },
              { value: 'oldest', label: t('common.oldestFirst') },
            ]}
            className="w-[200px]"
          />
        </div>
      </Card>

      <div className="mt-5">
        {loading ? (
          <Card className="p-5">
            <Skeleton className="h-[400px] w-full" />
          </Card>
        ) : (
          <DriversTable drivers={filtered} />
        )}
      </div>

      <Pagination currentPage={page} totalPages={8} onChange={setPage} />
    </DashboardShell>
  );
}
