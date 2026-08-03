'use client';

import { MapPin, MapPinOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';

interface LocationLabelProps {
  /** Absent = the record has never reported a position. */
  coordinates?: { lat: number; lng: number };
  /**
   * Human-readable place parts, most specific first — e.g. `[district, city]`
   * for a cabinet, `[city]` for a vehicle. Empty and undefined parts are
   * dropped, so a record with a district but no city renders "Al Olaya", not
   * "Al Olaya, ".
   */
  parts?: (string | undefined | null)[];
  /** Renders the pin icon. Table cells usually don't have room. */
  withIcon?: boolean;
  className?: string;
}

/**
 * A record's location, including the honest answer when there isn't one.
 *
 * Vehicles, cabinets and piles all used to carry a hardcoded central-Riyadh
 * coordinate — and cabinets and piles a hardcoded city *name* — whenever the
 * backend sent no position. Those defaults are gone, so anything that has never
 * reported a position is now excluded from every map. The lists have to say why:
 * otherwise an operator reads a blank cell as "no address recorded" and never
 * learns the record is missing from the map entirely.
 *
 * Any place text on the record is still shown, because a recorded district or
 * city is real information — it just is not a position.
 */
export function LocationLabel({
  coordinates,
  parts = [],
  withIcon = true,
  className,
}: LocationLabelProps) {
  const { t } = useI18n();
  const place = parts.filter((p) => p != null && p !== '').join(', ');

  if (coordinates) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        {withIcon && <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="truncate">
          {place || <span className="text-slate-400">—</span>}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500', className)}
      title={t('common.locationUnknownHint')}
    >
      {withIcon && <MapPinOff className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate italic">
        {t('common.locationUnknown')}
        {place && <span className="not-italic"> · {place}</span>}
      </span>
    </span>
  );
}
