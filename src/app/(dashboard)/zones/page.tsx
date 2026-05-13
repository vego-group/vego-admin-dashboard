'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { ZoneCard } from '@/components/zones/ZoneCard';
import { ZoneMap } from '@/components/zones/ZoneMap';
import { ZoneFormDrawer, type ZoneFormValues } from '@/components/zones/ZoneFormDrawer';
import { useI18n } from '@/i18n/I18nProvider';
import { zonesApi } from '@/lib/api';
import type { Zone, ZonePoint } from '@/types';

type FormMode = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; zone: Zone };

// Need a slightly different success dialog for zones — extend by passing custom labels
type SuccessKind = 'added' | 'updated' | 'deleted';

export default function ZonesPage() {
  const { t } = useI18n();

  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Drawing state
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<ZonePoint[]>([]);

  // Modals
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'closed' });
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successDialog, setSuccessDialog] = useState<
    | { kind: 'added' }
    | { kind: 'updated' }
    | { kind: 'deleted'; zone: Zone; position: number }
    | null
  >(null);

  // Load zones
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await zonesApi.list();
      if (!cancelled) {
        setZones(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredZones = useMemo(() => {
    if (!query) return zones;
    const q = query.toLowerCase();
    return zones.filter((z) => z.name.toLowerCase().includes(q));
  }, [zones, query]);

  // ----- Drawing flow -------------------------------------------------------

  const startDrawing = () => {
    setDrawingMode(true);
    setDrawingPoints([]);
    setSelectedZoneId(null);
  };

  const cancelDrawing = () => {
    setDrawingMode(false);
    setDrawingPoints([]);
  };

  const finishDrawing = () => {
    if (drawingPoints.length < 3) return;
    setDrawingMode(false);
    setFormMode({ kind: 'add' });
  };

  // ----- CRUD handlers ------------------------------------------------------

  const handleAdd = async (values: ZoneFormValues) => {
    const created = await zonesApi.create({
      name: values.name,
      type: values.type,
      speedLimitKmh: values.speedLimitKmh,
      active: values.active,
      polygon: drawingPoints,
    });
    setZones((prev) => [created, ...prev]);
    setDrawingPoints([]);
    setFormMode({ kind: 'closed' });
    setSuccessDialog({ kind: 'added' });
  };

  const handleEdit = async (values: ZoneFormValues, zoneId?: string) => {
    if (!zoneId) return;
    const updated = await zonesApi.update(zoneId, {
      name: values.name,
      type: values.type,
      speedLimitKmh: values.speedLimitKmh,
      active: values.active,
    });
    if (updated) {
      setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
      setFormMode({ kind: 'closed' });
      setSuccessDialog({ kind: 'updated' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!zoneToDelete) return;
    setDeleting(true);
    const position = zones.findIndex((z) => z.id === zoneToDelete.id);
    const removed = await zonesApi.remove(zoneToDelete.id);
    setDeleting(false);
    if (removed) {
      setZones((prev) => prev.filter((z) => z.id !== removed.id));
      setSuccessDialog({ kind: 'deleted', zone: removed, position });
    }
    setZoneToDelete(null);
  };

  const handleUndoDelete = async () => {
    if (successDialog?.kind !== 'deleted') return;
    const { zone, position } = successDialog;
    await zonesApi.restore(zone, position);
    setZones((prev) => {
      const next = [...prev];
      next.splice(position, 0, zone);
      return next;
    });
  };

  // ----- Inline mutations (toggle active / visible) -------------------------

  const handleToggleActive = async (zone: Zone, next: boolean) => {
    // Optimistic update
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, active: next } : z)));
    await zonesApi.update(zone.id, { active: next });
  };

  const handleToggleVisible = async (zone: Zone) => {
    const next = !zone.visible;
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, visible: next } : z)));
    await zonesApi.update(zone.id, { visible: next });
  };

  // ----- Render -------------------------------------------------------------

  // Custom labels for the SuccessDialog (it accepts zone-specific text via the i18n keys)
  const successTitle =
    successDialog?.kind === 'added'
      ? t('zones.zoneAddedSuccessfully')
      : successDialog?.kind === 'updated'
      ? t('zones.zoneUpdatedSuccessfully')
      : successDialog?.kind === 'deleted'
      ? t('zones.zoneDeletedSuccessfully')
      : '';
  const successDescription =
    successDialog?.kind === 'added'
      ? t('zones.zoneAddedDescription')
      : successDialog?.kind === 'updated'
      ? t('zones.zoneUpdatedDescription')
      : successDialog?.kind === 'deleted'
      ? t('zones.zoneDeletedDescription')
      : '';

  return (
    <DashboardShell title={t('zones.title')} subtitle={t('zones.subtitle')}>
      {/* Two-column layout: list (left) | map (right) */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* LEFT: Search + Zones list */}
        <Card className="flex flex-col p-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
          <Input
            placeholder={t('zones.searchByZone')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pe-1 scrollbar-thin">
            {loading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </>
            ) : filteredZones.length === 0 ? (
              <div className="flex h-full items-center justify-center py-10 text-sm text-slate-500">
                {t('common.noData')}
              </div>
            ) : (
              filteredZones.map((zone) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  selected={zone.id === selectedZoneId}
                  onSelect={() => setSelectedZoneId(zone.id)}
                  onToggleActive={(next) => handleToggleActive(zone, next)}
                  onToggleVisible={() => handleToggleVisible(zone)}
                  onEdit={() => setFormMode({ kind: 'edit', zone })}
                  onDelete={() => setZoneToDelete(zone)}
                />
              ))
            )}
          </div>
        </Card>

        {/* RIGHT: Map + toolbar */}
        <div className="flex flex-col gap-3" style={{ minHeight: 'calc(100vh - 180px)' }}>
          {/* Map toolbar */}
          <div className="flex items-center justify-end gap-2">
            {drawingMode ? (
              <>
                <Button
                  variant="secondary"
                  onClick={cancelDrawing}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  {t('zones.cancelDrawing')}
                </Button>
                <Button
                  variant="primary"
                  onClick={finishDrawing}
                  disabled={drawingPoints.length < 3}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  {t('zones.finishDrawing')}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={startDrawing}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {t('zones.addNewZone')}
              </Button>
            )}
          </div>

          {/* Map */}
          <div className="flex-1">
            <ZoneMap
              zones={zones}
              selectedZoneId={selectedZoneId}
              onZoneClick={(z) => setSelectedZoneId(z.id)}
              drawingMode={drawingMode}
              drawingPoints={drawingPoints}
              onDrawingPointAdd={(p) => setDrawingPoints((prev) => [...prev, p])}
            />
          </div>
        </div>
      </div>

      {/* Form drawer (Add / Edit) */}
      <ZoneFormDrawer
        open={formMode.kind !== 'closed'}
        onClose={() => {
          setFormMode({ kind: 'closed' });
          setDrawingPoints([]);
        }}
        zone={formMode.kind === 'edit' ? formMode.zone : null}
        drawingPoints={drawingPoints}
        onSubmit={(values, id) =>
          formMode.kind === 'edit'
            ? handleEdit(values, id)
            : handleAdd(values)
        }
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!zoneToDelete}
        onClose={() => setZoneToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('zones.deleteZoneTitle')}
        description={t('zones.deleteZoneDescription')}
        confirmLabel={t('zones.deleteZoneConfirm')}
        isLoading={deleting}
      />

      {/* Success dialog — reuses the SuccessDialog with custom labels via render-prop pattern */}
      <ZoneSuccessDialog
        open={!!successDialog}
        onClose={() => setSuccessDialog(null)}
        kind={successDialog?.kind ?? 'added'}
        title={successTitle}
        description={successDescription}
        onUndo={successDialog?.kind === 'deleted' ? handleUndoDelete : undefined}
      />
    </DashboardShell>
  );
}

// ----- A thin variant of SuccessDialog that accepts custom title/description -

import { Modal } from '@/components/ui/Modal';
import { Check, Trash2 } from 'lucide-react';

interface ZoneSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  kind: SuccessKind;
  title: string;
  description: string;
  onUndo?: () => void;
}

function ZoneSuccessDialog({
  open,
  onClose,
  kind,
  title,
  description,
  onUndo,
}: ZoneSuccessDialogProps) {
  const { t } = useI18n();
  const isDelete = kind === 'deleted';
  const autoCloseMs = 5000;
  const [remaining, setRemaining] = useState(autoCloseMs);

  useEffect(() => {
    if (!open || !isDelete) return;
    setRemaining(autoCloseMs);
    const tick = setInterval(() => setRemaining((r) => Math.max(0, r - 100)), 100);
    const close = setTimeout(() => onClose(), autoCloseMs);
    return () => {
      clearInterval(tick);
      clearTimeout(close);
    };
  }, [open, isDelete, onClose]);

  const progress = isDelete ? (remaining / autoCloseMs) * 100 : 0;
  const secondsLeft = isDelete ? Math.ceil(remaining / 1000) : 0;

  return (
    <Modal open={open} onClose={onClose} size="sm" hideCloseButton>
      <div className="px-6 pb-6 pt-8 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isDelete
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
          }`}
        >
          {isDelete ? <Trash2 className="h-6 w-6" /> : <Check className="h-6 w-6" strokeWidth={2.5} />}
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onClose} className="min-w-[110px]">
            {t('common.close')}
          </Button>
          {isDelete && onUndo && (
            <Button
              variant="primary"
              onClick={() => {
                onUndo();
                onClose();
              }}
              className="min-w-[110px]"
            >
              {t('common.undo')}
              {secondsLeft > 0 && (
                <span className="ms-1 text-xs font-normal opacity-80 tabular-nums">
                  ({secondsLeft}s)
                </span>
              )}
            </Button>
          )}
        </div>

        {isDelete && (
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
