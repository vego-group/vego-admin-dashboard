'use client';

import { UserPlus, UserCog } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { LocationLabel } from '@/components/ui/LocationLabel';
import { useI18n } from '@/i18n/I18nProvider';
import type { Vehicle } from '@/types';

interface FleetTableProps {
  vehicles: Vehicle[];
  /** Opens the assign/change-driver flow for a vehicle. */
  onAssignDriver?: (vehicle: Vehicle) => void;
}

export function FleetTable({ vehicles, onAssignDriver }: FleetTableProps) {
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
              {onAssignDriver && <th className="px-5 py-4 font-semibold">{t('fleet.actions')}</th>}
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
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                  <LocationLabel coordinates={v.coordinates} parts={[v.location]} withIcon={false} />
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={v.status} />
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {v.batteryLevel}%
                </td>
                {onAssignDriver && (
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onAssignDriver(v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                    >
                      {v.assignedDriverName
                        ? <UserCog className="h-3.5 w-3.5" />
                        : <UserPlus className="h-3.5 w-3.5" />}
                      {v.assignedDriverName ? t('fleet.changeDriver') : t('fleet.assignDriverAction')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
