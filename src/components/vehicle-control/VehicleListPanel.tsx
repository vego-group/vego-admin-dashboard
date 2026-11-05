'use client';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { BatteryBar } from '@/components/ui/BatteryBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { VehicleIconTile } from '@/components/ui/VehicleIconTile';
import { Search, User } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { cn } from '@/lib/cn';
import { vehicleDisplayName, vehicleMatches } from '@/lib/vehicle-label';
import { useState, useMemo } from 'react';
import type { Vehicle } from '@/types';

interface VehicleListPanelProps {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VehicleListPanel({ vehicles, selectedId, onSelect }: VehicleListPanelProps) {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();
  const [query, setQuery] = useState('');

  // Plate first: it is what is written on the machine.
  const filtered = useMemo(
    () => (query ? vehicles.filter((v) => vehicleMatches(v, query)) : vehicles),
    [vehicles, query],
  );

  return (
    <Card className="flex h-full flex-col p-3">
      <div className="px-2 pt-2">
        <Input
          placeholder={tv('vehicleControl.searchVehicles')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pe-1 scrollbar-thin">
        {filtered.map((v) => {
          const isSelected = v.id === selectedId;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className={cn(
                  'group w-full rounded-xl border bg-white p-3 text-start transition-all',
                  'hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm',
                  'dark:bg-slate-900/40 dark:hover:bg-slate-800/40',
                  isSelected && 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 dark:bg-slate-800/60'
                )}
                style={!isSelected ? { borderColor: 'rgb(var(--border))' } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <VehicleIconTile status={v.status} size="sm" />
                    {/* The real plate (LTR), then the model and the id — no
                        invented labels (FA-205). */}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-50">
                        <span dir="ltr">{vehicleDisplayName(v)}</span>
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {v.model}
                        {v.model && v.plateNumber && ' · '}
                        {v.plateNumber && <span dir="ltr">#{v.id}</span>}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={v.status} />
                </div>

                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">{t('fleet.battery')}</span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {v.batteryLevel}%
                    </span>
                  </div>
                  <BatteryBar value={v.batteryLevel} size="sm" className="mt-1" />
                </div>

                {v.assignedDriverName && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <User className="h-3 w-3" />
                    {v.assignedDriverName}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
