'use client';

import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { useI18n } from '@/i18n/I18nProvider';
import type { Vehicle } from '@/types';

interface FleetTableProps {
  vehicles: Vehicle[];
}

export function FleetTable({ vehicles }: FleetTableProps) {
  const { t } = useI18n();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right"
              style={{ borderColor: 'rgb(var(--border))' }}>
              <th className="px-5 py-4 font-semibold">{t('fleet.vehicleId')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.plateNumber')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.model')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.assignedDriver')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.location')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.status')}</th>
              <th className="px-5 py-4 font-semibold">{t('fleet.soc')}</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr
                key={v.id}
                className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-200">
                  #Vehi-{v.id.replace('M', '10')}
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{v.plateNumber}</td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{v.model}</td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                  {v.assignedDriverName ?? '—'}
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{v.location}</td>
                <td className="px-5 py-4">
                  <StatusPill status={v.status} />
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {v.batteryLevel}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
