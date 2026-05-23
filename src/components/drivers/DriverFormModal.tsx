'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, User, Car, FileText, Upload, Check, X, AlertTriangle, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { Driver, DriverStatus, DocumentStatus } from '@/types';

// ── Form value shape ──────────────────────────────────────────────────────────

export interface DriverFormValues {
  fullName: string;
  phone: string;
  email: string;
  vehicleModel: string;
  status: DriverStatus;
  // Documents (all optional)
  hasLicense: boolean;
  licenseFrontName: string;
  licenseBackName: string;
  licenseNumber: string;
  licenseExpiry: string;
  customsCardName: string;
  plateImageName: string;
  plateNumber: string;
}

const emptyForm: DriverFormValues = {
  fullName: '',
  phone: '',
  email: '',
  vehicleModel: '',
  status: 'active',
  hasLicense: false,
  licenseFrontName: '',
  licenseBackName: '',
  licenseNumber: '',
  licenseExpiry: '',
  customsCardName: '',
  plateImageName: '',
  plateNumber: '',
};

// ── Component props ───────────────────────────────────────────────────────────

interface DriverFormModalProps {
  open: boolean;
  onClose: () => void;
  driver?: Driver | null;
  onSubmit: (values: DriverFormValues, driverId?: string) => void | Promise<void>;
}

const VEHICLE_OPTIONS = ['', 'VEGO Pro 400', 'VEGO Cargo 500', 'VegoMax Pro', 'VegoLite'];
const STATUS_OPTIONS: DriverStatus[] = ['active', 'on_leave', 'inactive'];

// ── Main modal ────────────────────────────────────────────────────────────────

export function DriverFormModal({ open, onClose, driver, onSubmit }: DriverFormModalProps) {
  const { t } = useI18n();
  const isEdit = !!driver;

  const [values, setValues] = useState<DriverFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (driver) {
      setValues({
        fullName: driver.name,
        phone: driver.phone,
        email: '',
        vehicleModel: driver.vehicleModel,
        status: driver.status,
        hasLicense: driver.documents.license.hasLicense,
        licenseFrontName: driver.documents.license.status !== 'not_uploaded' ? 'existing-front.jpg' : '',
        licenseBackName: '',
        licenseNumber: driver.documents.license.number ?? '',
        licenseExpiry: driver.documents.license.expiryDate ?? '',
        customsCardName: driver.documents.customsCard.status !== 'not_uploaded' ? 'existing-customs.pdf' : '',
        plateImageName: driver.documents.plate.status !== 'not_uploaded' ? 'existing-plate.jpg' : '',
        plateNumber: driver.documents.plate.number ?? '',
      });
    } else {
      setValues(emptyForm);
    }
    setErrors({});
  }, [open, driver]);

  const update = <K extends keyof DriverFormValues>(key: K, val: DriverFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!values.fullName.trim()) next.fullName = t('drivers.fullNameRequired');
    if (!values.phone.trim()) next.phone = t('drivers.phoneRequired');
    else if (!/^\d{6,}$/.test(values.phone.trim())) next.phone = t('drivers.phoneInvalid');
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) next.email = t('drivers.emailInvalid');
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

  const existingDocStatus = isEdit ? driver!.documents : null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div
          className="flex items-start gap-3 border-b px-6 pb-4 pt-5"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isEdit ? t('drivers.editDriver') : t('drivers.addNewDriver')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEdit ? t('drivers.editDriverDescription') : t('drivers.addDriverDescription')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-5">

          {/* ── Personal Information ─────────────────────────────────────── */}
          <SectionHeader icon={<User className="h-4 w-4" />} title={t('drivers.personalInformation')} />

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('drivers.fullName')} required error={errors.fullName}>
              <Input
                placeholder="Ahmed Al-Khaldi"
                value={values.fullName}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </Field>
            <Field label={t('drivers.phoneNumber')} required error={errors.phone}>
              <Input
                placeholder="5xxxxxxxx"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                inputMode="tel"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label={`${t('drivers.emailAddress')} (${t('common.optional')})`} error={errors.email}>
              <Input
                type="email"
                placeholder="driver@example.com"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
          </div>

          {/* ── Vehicle Assignment ───────────────────────────────────────── */}
          <div className="mt-6">
            <SectionHeader icon={<Car className="h-4 w-4" />} title={t('drivers.vehicleAssignment')} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('drivers.assignVehicle')} required>
              <NativeSelect value={values.vehicleModel} onChange={(e) => update('vehicleModel', e.target.value)}>
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

          {/* ── Documents ────────────────────────────────────────────────── */}
          <div className="mt-6">
            <SectionHeader icon={<FileText className="h-4 w-4" />} title={t('drivers.documents')} />
          </div>

          {/* Optional notice */}
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {t('drivers.allDocsOptional')}
          </p>

          {/* Driving License */}
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('drivers.drivingLicense')}
              </span>
              {isEdit && (
                <DocStatusBadge status={existingDocStatus!.license.status} />
              )}
            </div>

            {/* Toggle */}
            <div className="mt-3 flex gap-2">
              <ToggleButton
                active={values.hasLicense}
                onClick={() => update('hasLicense', true)}
                label={t('drivers.hasLicense')}
              />
              <ToggleButton
                active={!values.hasLicense}
                onClick={() => update('hasLicense', false)}
                label={t('drivers.noLicense')}
              />
            </div>

            {values.hasLicense && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FileUploadBox
                    label={t('drivers.licenseFront')}
                    fileName={values.licenseFrontName}
                    onFileSelect={(n) => update('licenseFrontName', n)}
                    accept="image/*"
                  />
                  <FileUploadBox
                    label={`${t('drivers.licenseBack')} (${t('common.optional')})`}
                    fileName={values.licenseBackName}
                    onFileSelect={(n) => update('licenseBackName', n)}
                    accept="image/*"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={`${t('drivers.licenseNumber')} (${t('common.optional')})`}>
                    <Input
                      placeholder="SA-XXXXXX"
                      value={values.licenseNumber}
                      onChange={(e) => update('licenseNumber', e.target.value)}
                    />
                  </Field>
                  <Field label={`${t('drivers.licenseExpiry')} (${t('common.optional')})`}>
                    <Input
                      type="date"
                      value={values.licenseExpiry}
                      onChange={(e) => update('licenseExpiry', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Customs Card */}
          <div className="mt-3 rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('drivers.customsCard')}
              </span>
              {isEdit && (
                <DocStatusBadge status={existingDocStatus!.customsCard.status} />
              )}
            </div>
            <div className="mt-3">
              <FileUploadBox
                label={`${t('common.optional')}`}
                fileName={values.customsCardName}
                onFileSelect={(n) => update('customsCardName', n)}
                accept="image/*,.pdf"
              />
            </div>
          </div>

          {/* License Plate */}
          <div className="mt-3 rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('drivers.licensePlate')}
              </span>
              {isEdit && (
                <DocStatusBadge status={existingDocStatus!.plate.status} />
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FileUploadBox
                label={`${t('common.optional')}`}
                fileName={values.plateImageName}
                onFileSelect={(n) => update('plateImageName', n)}
                accept="image/*"
              />
              <Field label={`${t('drivers.plateNumber')} (${t('common.optional')})`}>
                <Input
                  placeholder="ABC 1234"
                  value={values.plateNumber}
                  onChange={(e) => update('plateNumber', e.target.value)}
                />
              </Field>
            </div>
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

// ── Internal helpers ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
      <span className="text-indigo-600 dark:text-indigo-400">{icon}</span>
      {title}
    </div>
  );
}

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
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

function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
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

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-4 py-2 text-xs font-semibold transition-all',
        active
          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
      )}
    >
      {label}
    </button>
  );
}

function FileUploadBox({
  label, fileName, onFileSelect, accept = 'image/*,.pdf',
}: {
  label: string; fileName: string; onFileSelect: (name: string) => void; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = !!fileName;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file.name);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'group flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-all',
          hasFile
            ? 'border-indigo-300 bg-indigo-50/30 dark:border-indigo-500/40 dark:bg-indigo-500/10'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 dark:border-slate-700 dark:hover:border-indigo-500/40'
        )}
      >
        {hasFile ? (
          <>
            <Check className="h-5 w-5 text-indigo-500" />
            <span className="max-w-full truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {fileName}
            </span>
            <span className="text-[10px] text-slate-400">Click to change</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-[10px] text-indigo-500">Click to upload</span>
          </>
        )}
      </button>
    </div>
  );
}

const DOC_STATUS_CONFIG: Record<DocumentStatus, { label: string; icon: React.ReactNode; className: string }> = {
  not_uploaded: {
    label: 'Not Uploaded',
    icon: <X className="h-3 w-3" />,
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  },
  pending: {
    label: 'Pending',
    icon: <Clock className="h-3 w-3" />,
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  },
  verified: {
    label: 'Verified',
    icon: <Check className="h-3 w-3" />,
    className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  rejected: {
    label: 'Rejected',
    icon: <AlertTriangle className="h-3 w-3" />,
    className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  },
};

function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = DOC_STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
