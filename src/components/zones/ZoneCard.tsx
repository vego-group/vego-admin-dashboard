'use client';

import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { useI18n } from '@/i18n/I18nProvider';
import { ZONE_TYPES } from '@/lib/zone-types';
import { cn } from '@/lib/cn';
import type { Zone } from '@/types';

interface ZoneCardProps {
  zone: Zone;
  selected?: boolean;
  onSelect?: () => void;
  onToggleActive: (next: boolean) => void;
  onToggleVisible: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ZoneCard({
  zone,
  selected,
  onSelect,
  onToggleActive,
  onToggleVisible,
  onEdit,
  onDelete,
}: ZoneCardProps) {
  const { t } = useI18n();
  const config = ZONE_TYPES[zone.type];

  // Speed limit display — color depends on zone type
  const speedColor = {
    normal:     'text-emerald-600',
    slow:       'text-amber-600',
    restricted: 'text-rose-600',
  }[zone.type];

  return (
    <div
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-xl border bg-white p-3.5 transition-all dark:bg-slate-900/40',
        'hover:border-brand-300 hover:shadow-sm',
        selected
          ? 'border-rose-400 ring-2 ring-rose-400/20'
          : ''
      )}
      style={!selected ? { borderColor: 'rgb(var(--border))' } : undefined}
    >
      {/* Header: name + visibility toggle */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
            {zone.name}
          </h3>
          <div className="mt-1.5">
            <Badge tone={config.badgeTone}>
              {t(`zones.types.${config.labelKey}`)}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className="-mt-1 -me-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          aria-label={zone.visible ? t('zones.hideFromMap') : t('zones.showOnMap')}
          title={zone.visible ? t('zones.hideFromMap') : t('zones.showOnMap')}
        >
          {zone.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {/* Active toggle */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={zone.active}
            onChange={(next) => onToggleActive(next)}
            aria-label={t('zones.activeLabel')}
          />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {zone.active ? t('zones.activeLabel') : t('zones.inactiveLabel')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10"
            aria-label={t('common.edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Speed limit row */}
      <div
        className="mt-3 flex items-center justify-between border-t pt-3 text-xs"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <span className="text-slate-500">{t('zones.speedLimit')}</span>
        <span className={cn('font-bold tabular-nums', speedColor)}>
          {config.speedLabelOverride === 'no_riding'
            ? t('zones.noRiding')
            : `${zone.speedLimitKmh} km/h`}
        </span>
      </div>
    </div>
  );
}
