'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, Lock, Power, Unlock } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Vehicle } from '@/types';

interface ControlPanelProps {
  vehicle: Vehicle;
  onUpdate?: (updates: Partial<Vehicle>) => void;
}

export function ControlPanel({ vehicle, onUpdate }: ControlPanelProps) {
  const { t } = useI18n();
  const [isLocked, setIsLocked] = useState(vehicle.isLocked);
  const [isRunning, setIsRunning] = useState(vehicle.isEngineRunning);
  const [speedLimit, setSpeedLimit] = useState(vehicle.speedLimitKmh);

  const toggleLock = () => {
    const next = !isLocked;
    setIsLocked(next);
    onUpdate?.({ isLocked: next });
  };

  const toggleEngine = () => {
    const next = !isRunning;
    setIsRunning(next);
    onUpdate?.({ isEngineRunning: next });
  };

  const handleSpeedChange = (value: number) => {
    setSpeedLimit(value);
    onUpdate?.({ speedLimitKmh: value });
  };

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
            onClick={toggleEngine}
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
            onClick={toggleLock}
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
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0</span>
            <span>22.5</span>
            <span>45</span>
          </div>
        </div>

        {/* Current Speed */}
        <div className="mt-4 rounded-xl border bg-slate-50 p-3 dark:bg-slate-800/40"
          style={{ borderColor: 'rgb(var(--border))' }}>
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
    danger: 'text-rose-600',
    neutral: 'text-slate-600 dark:text-slate-300',
  }[tone];

  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-semibold', toneClass)}>{value}</span>
    </li>
  );
}
