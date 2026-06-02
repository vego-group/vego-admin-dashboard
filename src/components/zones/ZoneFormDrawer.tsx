'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Map as MapIcon, Save } from 'lucide-react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useI18n } from '@/i18n/I18nProvider';
import { ZONE_TYPES, ZONE_TYPE_LIST } from '@/lib/zone-types';
import { cn } from '@/lib/cn';
import type { Zone, ZonePoint, ZoneType } from '@/types';

export interface ZoneFormValues {
  name: string;
  type: ZoneType;
  speedLimitKmh: number;
  active: boolean;
}

interface ZoneFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When set, the drawer is in "edit" mode and the form is pre-filled. */
  zone?: Zone | null;
  /** Polygon being created — required when adding a new zone. */
  drawingPoints?: ZonePoint[];
  onSubmit: (values: ZoneFormValues, zoneId?: string) => void | Promise<void>;
}

const MAX_SPEED = 100;

export function ZoneFormDrawer({
  open,
  onClose,
  zone,
  drawingPoints,
  onSubmit,
}: ZoneFormDrawerProps) {
  const { t } = useI18n();
  const isEdit = !!zone;

  const [values, setValues] = useState<ZoneFormValues>({
    name: '',
    type: 'operational',
    speedLimitKmh: 25,
    active: true,
  });
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Hydrate form when opened
  useEffect(() => {
    if (!open) return;
    if (zone) {
      setValues({
        name: zone.name,
        type: zone.type,
        speedLimitKmh: zone.speedLimitKmh,
        active: zone.active,
      });
    } else {
      // New-zone defaults — start with operational type, default speed 25
      setValues({
        name: '',
        type: 'operational',
        speedLimitKmh: 25,
        active: true,
      });
    }
    setErrors({});
  }, [open, zone]);

  // When type changes, snap speed to that type's default
  // (only if the user hasn't typed in a custom value already? — for simplicity, always snap)
  const handleTypeChange = (next: ZoneType) => {
    const config = ZONE_TYPES[next];
    setValues((v) => ({ ...v, type: next, speedLimitKmh: config.defaultSpeedKmh }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = t('zones.nameRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(values, zone?.id);
    } finally {
      setSubmitting(false);
    }
  };

  // Speed slider label changes based on value
  const speedLabel =
    values.speedLimitKmh === 0
      ? t('zones.speedNoRideLabel')
      : values.speedLimitKmh <= 15
      ? t('zones.speedSlowLabel')
      : t('zones.speedNormalLabel');

  const typeConfig = ZONE_TYPES[values.type];

  return (
    <Drawer open={open} onClose={onClose} size="md" withBackdrop={false}>
      <DrawerHeader
        title={isEdit ? t('zones.updateZone') : t('zones.newZone')}
        subtitle={isEdit ? t('zones.updateZoneSubtitle') : t('zones.newZoneSubtitle')}
        icon={<MapIcon className="h-5 w-5" />}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Zone Name */}
          <Field
            label={t('zones.zoneName')}
            required
            error={errors.name}
          >
            <Input
              placeholder={t('zones.zoneNamePlaceholder')}
              value={values.name}
              onChange={(e) => {
                setValues((v) => ({ ...v, name: e.target.value }));
                if (errors.name) setErrors({});
              }}
            />
          </Field>

          {/* Zone Type */}
          <div className="mt-4">
            <Field label={t('zones.zoneType')} required>
              <div className="relative">
                <select
                  value={values.type}
                  onChange={(e) => handleTypeChange(e.target.value as ZoneType)}
                  className="h-11 w-full appearance-none rounded-xl border bg-white pe-10 ps-4 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900/40 dark:text-slate-200"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  {ZONE_TYPE_LIST.map((cfg) => (
                    <option key={cfg.type} value={cfg.type}>
                      {t(`zones.types.${cfg.labelKey}Long`)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>

            {/* Type description (green helper) */}
            <div
              className="mt-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: `${typeConfig.color}33`,
                backgroundColor: `${typeConfig.color}0d`,
                color: typeConfig.color,
              }}
            >
              {t(`zones.types.${typeConfig.descriptionKey}`)}
            </div>
          </div>

          {/* Speed slider */}
          <div className="mt-5">
            <Field label={t('zones.maxSpeedLimit')} required>
              <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900/40"
                style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={MAX_SPEED}
                    value={values.speedLimitKmh}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, speedLimitKmh: Number(e.target.value) }))
                    }
                    className="flex-1 accent-brand-600"
                  />
                  <div className="text-end">
                    <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {values.speedLimitKmh}
                    </span>
                    <span className="ms-1 text-xs font-medium text-slate-500">km/h</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>0 km/h</span>
                  <span className="font-semibold text-brand-600">{speedLabel}</span>
                  <span>{MAX_SPEED} km/h</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('zones.speedHint')}
              </p>
            </Field>
          </div>

          {/* Status */}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('zones.statusLabel')}
            </h3>
            <div className="mt-2 flex items-center justify-between rounded-xl border p-3"
              style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {values.active ? t('zones.activeLabel') : t('zones.inactiveLabel')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {values.active
                    ? t('zones.statusActiveDescription')
                    : t('zones.statusInactiveDescription')}
                </p>
              </div>
              <Switch
                checked={values.active}
                onChange={(next) => setValues((v) => ({ ...v, active: next }))}
              />
            </div>
          </div>

          {/* Notice banner */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              <span className="font-semibold">{t('zones.notice')}: </span>
              {t('zones.noticeText')}
            </p>
          </div>

          {/* Polygon point count (only for create mode) */}
          {!isEdit && drawingPoints && drawingPoints.length > 0 && (
            <div className="mt-3 text-center text-[11px] text-slate-500">
              {t('zones.drawingPointsCount', { count: drawingPoints.length })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="min-w-[110px]">
            {t('zones.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            leftIcon={<Save className="h-4 w-4" />}
            className="min-w-[140px]"
          >
            {isEdit ? t('zones.updateZone') : t('zones.saveZone')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={cn('mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300')}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
