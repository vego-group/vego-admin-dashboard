'use client';

import { useEffect, useState } from 'react';
import { Info, User, Car } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Driver, DriverStatus } from '@/types';

export interface DriverFormValues {
  fullName: string;
  phone: string;
  email: string;
  vehicleModel: string;
  status: DriverStatus;
}

interface DriverFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal is in "edit" mode and pre-fills with this driver. */
  driver?: Driver | null;
  onSubmit: (values: DriverFormValues, driverId?: string) => void | Promise<void>;
}

const VEHICLE_OPTIONS = [
  '',
  'VEGO Pro 400',
  'VEGO Cargo 500',
  'VegoMax Pro',
  'VegoLite',
];

const STATUS_OPTIONS: DriverStatus[] = ['active', 'on_leave', 'inactive'];

const emptyForm: DriverFormValues = {
  fullName: '',
  phone: '',
  email: '',
  vehicleModel: '',
  status: 'active',
};

export function DriverFormModal({ open, onClose, driver, onSubmit }: DriverFormModalProps) {
  const { t } = useI18n();
  const isEdit = !!driver;

  const [values, setValues] = useState<DriverFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  // Hydrate form when opened in edit mode
  useEffect(() => {
    if (!open) return;
    if (driver) {
      setValues({
        fullName: driver.name,
        phone: driver.phone,
        email: '', // Email isn't on Driver type — empty by default
        vehicleModel: driver.vehicleModel,
        status: driver.status,
      });
    } else {
      setValues(emptyForm);
    }
    setErrors({});
  }, [open, driver]);

  const update = <K extends keyof DriverFormValues>(key: K, value: DriverFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!values.fullName.trim()) next.fullName = t('drivers.fullNameRequired');
    if (!values.phone.trim()) next.phone = t('drivers.phoneRequired');
    else if (!/^\d{6,}$/.test(values.phone.trim()))
      next.phone = t('drivers.phoneInvalid');
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email))
      next.email = t('drivers.emailInvalid');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(values, driver?.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-start gap-3 border-b px-6 pb-4 pt-5"
          style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isEdit ? t('drivers.editDriver') : t('drivers.addNewDriver')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEdit
                ? t('drivers.editDriverDescription')
                : t('drivers.addDriverDescription')}
            </p>
          </div>
        </div>

        {/* Body — scrollable if long */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-5">
          {/* Personal information */}
          <SectionHeader icon={<User className="h-4 w-4" />} title={t('drivers.personalInformation')} />

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t('drivers.fullName')}
              required
              error={errors.fullName}
            >
              <Input
                placeholder="Ahmed Al-Khaldi"
                value={values.fullName}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </Field>

            <Field
              label={t('drivers.phoneNumber')}
              required
              error={errors.phone}
            >
              <Input
                placeholder="5xxxxxxxx"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                inputMode="tel"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field
              label={`${t('drivers.emailAddress')} (${t('common.optional')})`}
              error={errors.email}
            >
              <Input
                type="email"
                placeholder="driver@example.com"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
          </div>

          {/* Vehicle assignment */}
          <div className="mt-6">
            <SectionHeader icon={<Car className="h-4 w-4" />} title={t('drivers.vehicleAssignment')} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('drivers.assignVehicle')} required>
              <NativeSelect
                value={values.vehicleModel}
                onChange={(e) => update('vehicleModel', e.target.value)}
              >
                {VEHICLE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v === '' ? t('drivers.noVehicleAssigned') : v}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label={t('drivers.status')} required>
              <NativeSelect
                value={values.status}
                onChange={(e) => update('status', e.target.value as DriverStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s === 'on_leave' ? 'onLeave' : s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          {/* Hint banner */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p>
              <span className="font-semibold">{t('drivers.noteLabel')}:</span>{' '}
              {t('drivers.assignmentHint')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <Button type="button" variant="secondary" onClick={onClose} className="min-w-[110px]">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting} className="min-w-[140px]">
            {isEdit ? t('drivers.updateDriver') : t('drivers.addDriver')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Small internal helpers ----

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
      <span className="text-indigo-600 dark:text-indigo-400">{icon}</span>
      {title}
    </div>
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
      <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function NativeSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full appearance-none rounded-xl border bg-white px-3.5 text-sm text-slate-700 transition-colors',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        'dark:bg-slate-900/40 dark:text-slate-200',
        className
      )}
      style={{ borderColor: 'rgb(var(--border))' }}
      {...props}
    >
      {children}
    </select>
  );
}
