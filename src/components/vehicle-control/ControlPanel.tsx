'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, Lock, Power, Unlock, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Vehicle } from '@/types';
import type { Driver } from '@/types';

interface ControlPanelProps {
  vehicle: Vehicle;
  drivers?: Driver[];
  onAssignDriver?: (motorcycleId: string, driverId: string) => Promise<boolean>;
  onUnassignDriver?: (motorcycleId: string) => Promise<boolean>;
}

export function ControlPanel({
  vehicle,
  drivers = [],
  onAssignDriver,
  onUnassignDriver,
}: ControlPanelProps) {
  const { t } = useI18n();

  // Local UI-only controls (no backend endpoint for engine/lock/speed)
  const [isLocked,   setIsLocked]   = useState(vehicle.isLocked);
  const [isRunning,  setIsRunning]  = useState(vehicle.isEngineRunning);
  const [speedLimit, setSpeedLimit] = useState(vehicle.speedLimitKmh);

  // Driver assignment
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assigning,  setAssigning]  = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedDriverId || !onAssignDriver) return;
    setAssigning(true);
    setAssignError(null);
    const ok = await onAssignDriver(vehicle.id, selectedDriverId);
    setAssigning(false);
    if (!ok) setAssignError(t('vehicleControl.assignFailed'));
    else setSelectedDriverId('');
  };

  const handleUnassign = async () => {
    if (!onUnassignDriver) return;
    setAssigning(true);
    setAssignError(null);
    const ok = await onUnassignDriver(vehicle.id);
    setAssigning(false);
    if (!ok) setAssignError(t('vehicleControl.unassignFailed'));
  };

  // Only show active drivers who are not already assigned to this motorcycle
  const availableDrivers = drivers.filter(
    (d) => d.status === 'active' && d.id !== vehicle.assignedDriverId
  );

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.controlPanel')}
        </h3>

        {/* Power */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('vehicleControl.powerControl')}
          </p>
          <button
            type="button"
            onClick={() => setIsRunning((v) => !v)}
            className={cn(
              'mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.99]',
              isRunning
                ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
            )}
          >
            <Power className="h-4 w-4" />
            {isRunning ? t('vehicleControl.stopEngine') : t('vehicleControl.startEngine')}
          </button>
        </div>

        {/* Security Lock */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('vehicleControl.securityLock')}
          </p>
          <button
            type="button"
            onClick={() => setIsLocked((v) => !v)}
            className={cn(
              'mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all active:scale-[0.99]',
              isLocked
                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
            )}
          >
            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {isLocked ? t('vehicleControl.locked') : t('vehicleControl.unlocked')}
          </button>
        </div>

        {/* Speed limit */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {t('vehicleControl.speedLimit')}
            </p>
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {speedLimit} km/h
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={45}
            value={speedLimit}
            onChange={(e) => setSpeedLimit(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0</span>
            <span>22.5</span>
            <span>45</span>
          </div>
        </div>

        {/* Current Speed */}
        <div
          className="mt-4 rounded-xl border bg-slate-50 p-3 dark:bg-slate-800/40"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{t('vehicleControl.currentSpeed')}</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {vehicle.currentSpeedKmh} km/h
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              style={{ width: `${(vehicle.currentSpeedKmh / 45) * 100}%` }}
            />
          </div>
        </div>

        {/* Emergency */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('vehicleControl.emergency')}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-sm font-bold text-white shadow-sm transition-all hover:from-rose-700 hover:to-red-700 active:scale-[0.99]"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('vehicleControl.emergencyStop')}
          </button>
        </div>
      </Card>

      {/* Driver Assignment */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.driverAssignment')}
        </h3>

        {vehicle.assignedDriverName ? (
          /* Driver currently assigned — show name + unassign button */
          <div>
            <div
              className="flex items-center gap-3 rounded-xl border bg-slate-50/60 px-4 py-3 dark:bg-slate-800/40"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
                {vehicle.assignedDriverName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">{t('vehicleControl.assignedDriver')}</p>
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {vehicle.assignedDriverName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnassign}
              disabled={assigning}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
            >
              {assigning
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <UserMinus className="h-4 w-4" />
              }
              {t('vehicleControl.unassignDriver')}
            </button>
          </div>
        ) : (
          /* No driver — show dropdown + assign button */
          <div>
            <p className="mb-2 text-xs text-slate-500">{t('vehicleControl.noDriverAssigned')}</p>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className={cn(
                'h-10 w-full appearance-none rounded-xl border bg-white px-3 text-sm text-slate-700 transition-colors',
                'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                'dark:bg-slate-900/40 dark:text-slate-200',
              )}
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              <option value="">{t('vehicleControl.selectDriver')}</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.phone}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={!selectedDriverId || assigning}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {assigning
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <UserPlus className="h-4 w-4" />
              }
              {t('vehicleControl.assignDriver')}
            </button>
          </div>
        )}

        {/* Error */}
        {assignError && (
          <p className="mt-2 text-xs text-rose-600">{assignError}</p>
        )}
      </Card>

      {/* System Status */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.systemStatus')}
        </h3>
        <ul className="mt-3 space-y-2.5 text-sm">
          <SystemStatusRow
            label={t('vehicleControl.engine')}
            value={isRunning ? t('vehicleControl.running') : t('vehicleControl.stopped')}
            tone={isRunning ? 'success' : 'neutral'}
          />
          <SystemStatusRow
            label={t('vehicleControl.securityLock')}
            value={isLocked ? t('vehicleControl.locked') : t('vehicleControl.unlocked')}
            tone={isLocked ? 'neutral' : 'success'}
          />
          <SystemStatusRow
            label={t('vehicleControl.gpsSignal')}
            value={
              vehicle.gpsSignal === 'strong'
                ? t('vehicleControl.strong')
                : vehicle.gpsSignal === 'weak'
                ? t('vehicleControl.weak')
                : '—'
            }
            tone={vehicle.gpsSignal === 'strong' ? 'success' : 'warning'}
          />
          <SystemStatusRow
            label={t('vehicleControl.connection')}
            value={vehicle.isOnline ? t('vehicleControl.online') : t('vehicleControl.offline')}
            tone={vehicle.isOnline ? 'success' : 'danger'}
          />
        </ul>
      </Card>
    </div>
  );
}

function SystemStatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClass = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger:  'text-rose-600',
    neutral: 'text-slate-600 dark:text-slate-300',
  }[tone];

  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-semibold', toneClass)}>{value}</span>
    </li>
  );
}
