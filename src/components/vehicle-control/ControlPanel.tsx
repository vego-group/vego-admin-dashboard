'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { AlertTriangle, Lock, Power, ShieldCheck, Unlock, UserPlus, UserMinus, Loader2, WifiOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useVehicleTerm } from '@/hooks/useVehicleTerm';
import { cn } from '@/lib/cn';
import { VEHICLE_SPEED_LIMIT_MAX, clampSpeedLimit } from '@/lib/vehicle-speed';
import type { Vehicle } from '@/types';
import type { Driver } from '@/types';
import type { VehicleCommand, VehicleCommandOutcome } from '@/lib/api';

interface ControlPanelProps {
  vehicle: Vehicle;
  drivers?: Driver[];
  onAssignDriver?: (motorcycleId: string, driverId: string) => Promise<boolean>;
  onUnassignDriver?: (motorcycleId: string) => Promise<boolean>;
  /** Sends a real control command and reports exactly what happened to it. */
  onCommand?: (motorcycleId: string, action: VehicleCommand, speedLimit?: number) => Promise<VehicleCommandOutcome>;
}

export function ControlPanel({
  vehicle,
  drivers = [],
  onAssignDriver,
  onUnassignDriver,
  onCommand,
}: ControlPanelProps) {
  const { t } = useI18n();
  const { tv } = useVehicleTerm();

  // Control state — mirrors the backend, updated from each command's response.
  const [isLocked,   setIsLocked]   = useState(vehicle.isLocked);
  const [isRunning,  setIsRunning]  = useState(vehicle.isEngineRunning);
  /** null = the backend has never reported a limit for this vehicle. */
  const [speedLimit, setSpeedLimit] = useState<number | null>(vehicle.speedLimitKmh ?? null);
  const [pending,      setPending]      = useState<VehicleCommand | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);

  /**
   * Commands this vehicle's device has told us it cannot do.
   *
   * Seeded from the device's advertised list where there is one, and added to
   * whenever a command comes back `command_not_supported`. Without this the
   * operator can press a button the hardware will never honour, get the same
   * generic failure every time, and have no way to tell that from a bad
   * connection.
   */
  const [unsupported, setUnsupported] = useState<Set<VehicleCommand>>(new Set());

  const [confirmEmergencyStop, setConfirmEmergencyStop] = useState(false);

  // Re-sync when a different vehicle is selected (component instance is reused).
  useEffect(() => {
    setIsLocked(vehicle.isLocked);
    setIsRunning(vehicle.isEngineRunning);
    setSpeedLimit(vehicle.speedLimitKmh ?? null);
    setPending(null);
    setCommandError(null);
    setUnsupported(new Set());
    setConfirmEmergencyStop(false);
    // Only resync on vehicle switch, not on every optimistic prop update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  /**
   * Can this vehicle do this at all?
   *
   * An **absent** `supportedCommands` means the payload said nothing about
   * capabilities — not that there are none — so everything stays enabled and a
   * 422 is what teaches us otherwise. Only a list that exists and omits the
   * command rules it out up front.
   */
  const advertised = vehicle.supportedCommands;
  const isSupported = (action: VehicleCommand): boolean => {
    if (unsupported.has(action)) return false;
    if (advertised && !advertised.includes(action)) return false;
    return true;
  };

  /** Run a command; adopt whatever authoritative state came back with it. */
  const runCommand = async (action: VehicleCommand, nextSpeed?: number) => {
    if (!onCommand || pending || !isSupported(action)) return;
    setPending(action);
    setCommandError(null);

    const outcome = await onCommand(vehicle.id, action, nextSpeed);
    setPending(null);

    if (!outcome.ok) {
      if (outcome.reason === 'unsupported') {
        // Never offer it again — it is not going to start working.
        setUnsupported((prev) => new Set(prev).add(action));
        setCommandError(tv('vehicleControl.commandUnsupported'));
      } else {
        setCommandError(outcome.message ?? tv('vehicleControl.commandFailed'));
      }
      return;
    }

    // Only fields the backend actually reported (or the command itself implies)
    // are adopted. Anything it stayed silent about keeps its current value
    // rather than being reset to a default we made up.
    const { state } = outcome;
    if (state.isLocked        !== undefined) setIsLocked(state.isLocked);
    if (state.isEngineRunning !== undefined) setIsRunning(state.isEngineRunning);
    if (state.speedLimitKmh   !== undefined) setSpeedLimit(state.speedLimitKmh);
  };

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

  // ── Speed limit ────────────────────────────────────────────────────────────
  // One scale for every speed in this app — see @/lib/vehicle-speed. The slider
  // used to stop at 45 while the mapper handed it a default of 80, so a vehicle
  // arrived pinned to the wrong end and the first drag *sent* that wrong value.
  const engineCommand: VehicleCommand = isRunning ? 'stop' : 'start';
  const lockCommand:   VehicleCommand = isLocked  ? 'unlock' : 'lock';
  const speedSupported = isSupported('set_speed_limit');
  const sliderValue    = clampSpeedLimit(speedLimit ?? 0);
  const unsupportedTitle = tv('vehicleControl.commandUnsupportedTooltip');

  const speedTicks = useMemo(
    () => [0, VEHICLE_SPEED_LIMIT_MAX / 2, VEHICLE_SPEED_LIMIT_MAX],
    [],
  );

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t('vehicleControl.controlPanel')}
        </h3>

        {/*
          Who owns these controls. Individual owners DO get engine, lock and
          speed control in the mobile app, so a fleet operator who has heard
          that will ask why their drivers do not — this answers it in place
          rather than through support.
        */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <p>
            <span className="font-semibold">{tv('vehicleControl.fleetControlledTitle')}: </span>
            {tv('vehicleControl.fleetControlledNote')}
          </p>
        </div>

        {/* A command to an offline device may simply never arrive. Say so rather
            than letting a spinner and a success imply it did. */}
        {!vehicle.isOnline && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>{tv('vehicleControl.commandOffline')}</p>
          </div>
        )}

        {/* Power */}
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('vehicleControl.powerControl')}
          </p>
          <button
            type="button"
            onClick={() => runCommand(engineCommand)}
            disabled={!!pending || !isSupported(engineCommand)}
            title={!isSupported(engineCommand) ? unsupportedTitle : undefined}
            className={cn(
              'mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
              isRunning
                ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
            )}
          >
            {pending === 'start' || pending === 'stop'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Power className="h-4 w-4" />}
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
            onClick={() => runCommand(lockCommand)}
            disabled={!!pending || !isSupported(lockCommand)}
            title={!isSupported(lockCommand) ? unsupportedTitle : undefined}
            className={cn(
              'mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
              isLocked
                ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
            )}
          >
            {pending === 'lock' || pending === 'unlock'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {isLocked ? t('vehicleControl.locked') : t('vehicleControl.unlocked')}
          </button>
        </div>

        {/* Speed limit */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {t('vehicleControl.speedLimit')}
            </p>
            {/* An unreported limit says so. It used to read "80 km/h" — a number
                no fleet had set, on a slider that could not reach it. */}
            {speedLimit === null ? (
              <span className="text-xs font-medium text-slate-400">
                {tv('vehicleControl.speedLimitUnknown')}
              </span>
            ) : (
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {speedLimit} {t('common.kmh')}
              </span>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={VEHICLE_SPEED_LIMIT_MAX}
            value={sliderValue}
            disabled={!!pending || !speedSupported}
            title={!speedSupported ? unsupportedTitle : undefined}
            onChange={(e) => setSpeedLimit(Number(e.target.value))}
            // Commit to the backend only when the user releases the slider.
            onPointerUp={() => speedLimit !== null && runCommand('set_speed_limit', speedLimit)}
            onKeyUp={() => speedLimit !== null && runCommand('set_speed_limit', speedLimit)}
            className="mt-2 w-full accent-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            {speedTicks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
          {speedLimit === null && speedSupported && (
            <p className="mt-1 text-[11px] text-slate-400">
              {tv('vehicleControl.speedLimitUnknownHint')}
            </p>
          )}
        </div>

        {/* Current Speed */}
        <div
          className="mt-4 rounded-xl border bg-slate-50 p-3 dark:bg-slate-800/40"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{t('vehicleControl.currentSpeed')}</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {vehicle.currentSpeedKmh} {t('common.kmh')}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
              style={{
                // Same scale as every other speed here, so a vehicle doing
                // 60 km/h no longer renders as a full bar.
                width: `${(clampSpeedLimit(vehicle.currentSpeedKmh) / VEHICLE_SPEED_LIMIT_MAX) * 100}%`,
              }}
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
            // Confirmed, not fired on the click: this cuts the engine of a
            // vehicle that may have a driver on it right now.
            onClick={() => setConfirmEmergencyStop(true)}
            disabled={!!pending || !isSupported('emergency_stop')}
            title={!isSupported('emergency_stop') ? unsupportedTitle : undefined}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-sm font-bold text-white shadow-sm transition-all hover:from-rose-700 hover:to-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'emergency_stop'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <AlertTriangle className="h-4 w-4" />}
            {t('vehicleControl.emergencyStop')}
          </button>
        </div>

        {commandError && (
          <p className="mt-3 text-xs text-rose-600">{commandError}</p>
        )}
      </Card>

      <ConfirmDeleteDialog
        open={confirmEmergencyStop}
        onClose={() => setConfirmEmergencyStop(false)}
        onConfirm={() => {
          setConfirmEmergencyStop(false);
          void runCommand('emergency_stop');
        }}
        title={tv('vehicleControl.emergencyStopConfirmTitle')}
        description={tv('vehicleControl.emergencyStopConfirmDescription')}
        confirmLabel={tv('vehicleControl.emergencyStopConfirmAction')}
      />

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
            <p className="mb-2 text-xs text-slate-500">{tv('vehicleControl.noDriverAssigned')}</p>
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
            // 'none' used to render as a bare em dash — indistinguishable from
            // "we have no reading" when it means "the device reports no fix".
            value={
              vehicle.gpsSignal === 'strong'
                ? t('vehicleControl.strong')
                : vehicle.gpsSignal === 'weak'
                ? t('vehicleControl.weak')
                : t('vehicleControl.gpsNone')
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
