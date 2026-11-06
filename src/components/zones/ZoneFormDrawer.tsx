'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Map as MapIcon, Save, Users } from 'lucide-react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { FailureNote } from '@/components/ui/FailureNote';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import {
  ZONE_SPEED_LIMIT_MAX, ZONE_SPEED_LIMIT_MIN, ZONE_SPEED_SLIDER_MAX, ZONE_TYPES, ZONE_TYPE_LIST, isValidZoneSpeedLimit,
} from '@/lib/zone-types';
import { isArabicOnly, isEnglishOnly } from '@/lib/text-script';
import { failureLines, fieldErrorsFrom } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { Zone, ZonePoint, ZoneType } from '@/types';

export interface ZoneFormValues {
  name_en: string;
  name_ar: string;
  type: ZoneType;
  /** A `slow` zone's limit (1–200 km/h); `null` for every other type. */
  speedLimitKmh: number | null;
  active: boolean;
}

interface ZoneFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When set, the drawer is in "edit" mode and the form is pre-filled. */
  zone?: Zone | null;
  /** Polygon being created — required when adding a new zone. */
  drawingPoints?: ZonePoint[];
  /**
   * Saves the zone. A failure **throws**: an ApiError, whose field errors land
   * on their fields here, or a {@link ZoneSubmitRefusal} for a check the page
   * made itself. The drawer stays open and says why, inside itself (FA-326).
   */
  onSubmit: (values: ZoneFormValues, zoneId?: string) => Promise<void>;
}

/** A save the page refused before asking the backend, with its reasons. */
export class ZoneSubmitRefusal extends Error {
  constructor(readonly lines: string[]) {
    super(lines.join(' '));
    this.name = 'ZoneSubmitRefusal';
  }
}

type ZoneFormErrors = {
  name_en?: string;
  name_ar?: string;
  type?: string;
  speedLimit?: string;
  /** The polygon drawn on the map: it has no input, so it gets its own line. */
  coordinates?: string;
};

/**
 * The request keys of `POST` / `PUT /fleet-admin/zones` and the drawer field
 * each lands on. A 422 used to reach only a page banner, as `message`, which
 * this drawer can cover on a narrow screen (FA-326).
 */
const FIELD_BY_REQUEST_KEY = {
  name_en:     'name_en',
  name_ar:     'name_ar',
  type:        'type',
  speed_limit: 'speedLimit',
  coordinates: 'coordinates',
} as const satisfies Record<string, keyof ZoneFormErrors>;

/**
 * The slider's usual ceiling. Zones keep their own range (1–200, advisory);
 * the vehicle control's 10–80 km/h is the vehicle command's, not theirs.
 */
const MAX_SPEED = ZONE_SPEED_SLIDER_MAX;

/** The form's speed limit for a zone: its own on a slow zone, `null` on any other. */
function initialSpeedLimit(zone: Zone): number | null {
  return zone.type === 'slow' ? zone.speedLimitKmh : null;
}

export function ZoneFormDrawer({
  open,
  onClose,
  zone,
  drawingPoints,
  onSubmit,
}: ZoneFormDrawerProps) {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();
  const isEdit = !!zone;

  const [values, setValues] = useState<ZoneFormValues>({
    name_en: '',
    name_ar: '',
    type: 'normal',
    speedLimitKmh: null,
    active: true,
  });
  const [errors, setErrors] = useState<ZoneFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  /** Why the save was refused, when it is not one field's fault. */
  const [submitError, setSubmitError] = useState<string[] | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /** Each name field only accepts letters from its own script. */
  const scriptError = (field: 'name_en' | 'name_ar', value: string) => {
    if (!value.trim()) return undefined;
    if (field === 'name_en') {
      return isEnglishOnly(value) ? undefined : t('zones.nameEnMustBeEnglish');
    }
    return isArabicOnly(value) ? undefined : t('zones.nameArMustBeArabic');
  };

  const validateNames = (next: Pick<ZoneFormValues, 'name_en' | 'name_ar'>) => {
    const found: typeof errors = {};
    const nameEnError = next.name_en.trim()
      ? scriptError('name_en', next.name_en)
      : t('zones.nameRequired');
    if (nameEnError) found.name_en = nameEnError;
    const nameArError = scriptError('name_ar', next.name_ar);
    if (nameArError) found.name_ar = nameArError;
    return found;
  };

  // Hydrate form when opened
  useEffect(() => {
    if (!open) return;
    if (zone) {
      setValues({
        name_en: zone.name_en,
        name_ar: zone.name_ar,
        type: zone.type,
        speedLimitKmh: initialSpeedLimit(zone),
        active: zone.active,
      });
    } else {
      setValues({
        name_en: '',
        name_ar: '',
        type: 'normal',
        speedLimitKmh: null,
        active: true,
      });
    }
    setErrors({});
    setSubmitError(null);
  }, [open, zone]);

  /**
   * Flags the wrong script live as the user types. "Required" is deliberately
   * left to submit — nagging about an empty field mid-typing is noise.
   */
  const handleNameChange = (field: 'name_en' | 'name_ar', value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: scriptError(field, value) }));
  };

  // A speed limit only applies to a slow zone: switching to one starts at its
  // default, switching away clears it so nothing but `null` is sent.
  const handleTypeChange = (next: ZoneType) => {
    setValues((v) => ({
      ...v,
      type: next,
      speedLimitKmh: next === 'slow' ? (v.speedLimitKmh ?? ZONE_TYPES.slow.defaultSpeedKmh) : null,
    }));
    setErrors((prev) => ({ ...prev, type: undefined, speedLimit: undefined }));
  };

  /** Only a slow zone takes a limit, and it must be 1–200 km/h. */
  const validateSpeedLimit = (next: ZoneFormValues) =>
    next.type === 'slow' && !isValidZoneSpeedLimit(next.speedLimitKmh)
      ? t('zones.speedLimitRequired', { min: String(ZONE_SPEED_LIMIT_MIN), max: String(ZONE_SPEED_LIMIT_MAX) })
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = validateNames(values);
    const speedError = validateSpeedLimit(values);
    if (speedError) nextErrors.speedLimit = speedError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values, zone?.id);
    } catch (err) {
      showFailure(err);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Put a refused save where the operator will see it: each field the backend
   * named under that field, anything else in a note at the top of the drawer,
   * and scroll to the first of them.
   */
  const showFailure = (err: unknown) => {
    if (err instanceof ZoneSubmitRefusal) {
      setSubmitError(err.lines);
    } else {
      const byKey = fieldErrorsFrom(err, FIELD_BY_REQUEST_KEY);
      if (!byKey) {
        setSubmitError(failureLines(err, t));
      } else {
        const next: ZoneFormErrors = { ...byKey.fields };
        const unmapped = [...byKey.unmapped];
        // Only a slow zone shows the speed slider; elsewhere the message would
        // have nowhere to appear.
        if (next.speedLimit && values.type !== 'slow') {
          unmapped.push(next.speedLimit);
          delete next.speedLimit;
        }
        setErrors((prev) => ({ ...prev, ...next }));
        setSubmitError(unmapped.length > 0 ? unmapped : null);
      }
    }
    window.requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector('[role="alert"], [data-field-error]')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  // Speed slider label changes based on value
  const speedLabel =
    values.speedLimitKmh == null
      ? t('zones.noLimit')
      : values.speedLimitKmh <= 15
      ? t('zones.speedSlowLabel')
      : t('zones.speedNormalLabel');

  // A stored limit above the usual ceiling widens the slider rather than being
  // clamped — and silently saved — on the first edit.
  const sliderMax = Math.min(
    ZONE_SPEED_LIMIT_MAX,
    Math.max(MAX_SPEED, zone ? initialSpeedLimit(zone) ?? 0 : 0),
  );

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
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5">
          {/* A refused save, inside the drawer: a page banner sat behind it. */}
          {submitError && (
            <FailureNote
              className="mb-4 mt-0"
              title={isEdit ? t('zones.updateFailed') : t('zones.createFailed')}
              lines={submitError}
              onDismiss={() => setSubmitError(null)}
            />
          )}

          {/* Zone Name (English) */}
          <Field
            label={t('zones.zoneNameEn')}
            required
            error={errors.name_en}
          >
            <Input
              placeholder={t('zones.zoneNameEnPlaceholder')}
              value={values.name_en}
              onChange={(e) => handleNameChange('name_en', e.target.value)}
              dir="ltr"
              lang="en"
              aria-invalid={!!errors.name_en}
              style={errors.name_en ? { borderColor: '#f43f5e' } : undefined}
            />
          </Field>

          {/* Zone Name (Arabic) */}
          <div className="mt-4">
            <Field label={t('zones.zoneNameAr')} error={errors.name_ar}>
              <Input
                placeholder={t('zones.zoneNameArPlaceholder')}
                value={values.name_ar}
                onChange={(e) => handleNameChange('name_ar', e.target.value)}
                dir="rtl"
                lang="ar"
                aria-invalid={!!errors.name_ar}
                style={errors.name_ar ? { borderColor: '#f43f5e' } : undefined}
              />
            </Field>
          </div>

          {/* Zone Type */}
          <div className="mt-4">
            <Field label={t('zones.zoneType')} required error={errors.type}>
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
              {tv(`zones.types.${typeConfig.descriptionKey}`)}
            </div>
          </div>

          {/* Speed slider — a slow zone only. Every other type takes no limit
              and sends `speed_limit: null`. */}
          {values.type === 'slow' && (
            <div className="mt-5">
              <Field label={t('zones.maxSpeedLimit')} required error={errors.speedLimit}>
                <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-900/40"
                  style={{ borderColor: 'rgb(var(--border))' }}>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={ZONE_SPEED_LIMIT_MIN}
                      max={sliderMax}
                      value={values.speedLimitKmh ?? ZONE_TYPES.slow.defaultSpeedKmh ?? ZONE_SPEED_LIMIT_MIN}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, speedLimitKmh: Number(e.target.value) }));
                        setErrors((prev) => ({ ...prev, speedLimit: undefined }));
                      }}
                      aria-label={t('zones.maxSpeedLimit')}
                      aria-invalid={!!errors.speedLimit}
                      className="flex-1 accent-brand-600"
                    />
                    <div className="text-end">
                      <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {values.speedLimitKmh ?? '—'}
                      </span>
                      <span className="ms-1 text-xs font-medium text-slate-500">{t('common.kmh')}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{ZONE_SPEED_LIMIT_MIN} {t('common.kmh')}</span>
                    <span className="font-semibold text-brand-600">{speedLabel}</span>
                    <span>{sliderMax} {t('common.kmh')}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {tv('zones.speedHint')}
                </p>
              </Field>
            </div>
          )}

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

          {/* What a zone does and doesn't do. Zones are advisory: nothing pushes
              them to a vehicle (FA-303). They cover this fleet's drivers only,
              not everyone riding on those roads. */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <p>{tv('zones.enforcementScopeNote')}</p>
          </div>

          {/* Notice banner */}
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
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

          {/* The backend's word on the drawn shape, which has no input here. */}
          {errors.coordinates && (
            <p data-field-error className="mt-2 text-xs text-rose-600">
              <span className="font-semibold">{t('zones.shapeOnMap')}: </span>
              {errors.coordinates}
            </p>
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
      {error && <p data-field-error className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
