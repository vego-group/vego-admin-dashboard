'use client';

import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { useI18n } from '@/i18n/I18nProvider';
import type { Driver } from '@/types';
import { formatCurrency } from '@/lib/format';

interface DriversTableProps {
  drivers: Driver[];
}

export function DriversTable({ drivers }: DriversTableProps) {
  const { t, locale } = useI18n();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <th className="px-5 py-4">{t('drivers.driverId')}</th>
              <th className="px-5 py-4">{t('drivers.name')}</th>
              <th className="px-5 py-4">{t('drivers.phone')}</th>
              <th className="px-5 py-4">{t('drivers.vehicles')}</th>
              <th className="px-5 py-4">{t('drivers.status')}</th>
              <th className="px-5 py-4">{t('drivers.trips')}</th>
              <th className="px-5 py-4">{t('drivers.totalCost')}</th>
              <th className="px-5 py-4">{t('drivers.charges')}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr
                key={d.id}
                className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-200">
                  #{d.id}
                </td>
                <td className="px-5 py-4 text-slate-900 dark:text-slate-100">{d.name}</td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{d.phone}</td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                  {d.vehicleModel}
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={d.status} type="driver" />
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {d.trips}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {formatCurrency(d.totalCost, locale)}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {d.charges}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
