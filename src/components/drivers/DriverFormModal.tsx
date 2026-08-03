'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, User, Car, FileText, Upload, Check, X, AlertTriangle, Clock, Lock, Image as ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { useCountries } from '@/hooks/useCountries';
import { useFleetContext } from '@/hooks/useFleetContext';
import { driversApi } from '@/lib/api';
import { fieldErrorFrom } from '@/lib/api-errors';
import { flagEmoji, matchesPhoneRegex, toNationalNumber } from '@/lib/country';
import { cn } from '@/lib/cn';
import type { Country, Driver, DocumentStatus, DriverDocuments } from '@/types';

// ── Form value shape ──────────────────────────────────────────────────────────

/**
 * What this form actually submits.
 *
 * `status` and `vehicleModel` used to live here. Neither was ever sent: the
 * driver create/update endpoints accept no status (it belongs to
 * `/toggle-status`, `/block`, `/unblock`) and no model name (a motorcycle is
 * assigned by id through `POST /fleet-admin/motorcycles/{id}/assign-driver`,
 * which the Assign Vehicle action in the drivers table already does). A field
 * that cannot be saved does not belong on a form.
 */
export interface DriverFormValues {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  // Documents (all optional)
  hasLicense: boolean;
  licenseFrontName: string;
  licenseBackName: string;
  licenseNumber: string;
  licenseExpiry: string;
  plateImageName: string;
  plateNumber: string;
  // Actual files to upload (null when unchanged / not selected)
  licenseFrontFile: File | null;
  licenseBackFile: File | null;
  plateImageFile: File | null;
}

const emptyForm: DriverFormValues = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  hasLicense: false,
  licenseFrontName: '',
  licenseBackName: '',
  licenseNumber: '',
  licenseExpiry: '',
  plateImageName: '',
  plateNumber: '',
  licenseFrontFile: null,
  licenseBackFile: null,
  plateImageFile: null,
};

// ── Component props ───────────────────────────────────────────────────────────

interface DriverFormModalProps {
  open: boolean;
  onClose: () => void;
  driver?: Driver | null;
  onSubmit: (values: DriverFormValues, driverId?: string) => void | Promise<void>;
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function DriverFormModal({ open, onClose, driver, onSubmit }: DriverFormModalProps) {
  const { t, locale } = useI18n();
  const isEdit = !!driver;

  // A fleet does not span countries, so the driver's country is the fleet's and
  // is not a choice. It is shown, read-only, because it decides which phone rule
  // the number below is validated against.
  const { isoCountryCode: fleetIso, currencyStatus } = useFleetContext();
  const { byIso, isLoading: countriesLoading } = useCountries();
  const country = byIso(fleetIso);
  const countryPending = currencyStatus === 'pending' || countriesLoading;

  const [values, setValues] = useState<DriverFormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormValues, string>>>({});
  const [countryError, setCountryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Document detail (file_url + rejection_reason) — only the detail endpoint returns these.
  const [docDetail, setDocDetail] = useState<DriverDocuments | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setCountryError(null);
    if (driver) {
      // Reduce the stored number to its national form. The driver's own dial code
      // leads, because an existing record knows its country synchronously while
      // the fleet profile is still in flight; without one, toNationalNumber
      // sweeps every seeded prefix. Either way "+962…", "00962…", "0…" and the
      // Saudi equivalents all land on the same digits.
      const rawPhone = toNationalNumber(driver.phone, driver.dialCode);
      setValues({
        fullName: driver.name,
        phone: rawPhone,
        email: driver.email ?? '',
        address: driver.address ?? '',
        city: driver.city ?? '',
        hasLicense: driver.documents.license.hasLicense,
        licenseFrontName: driver.documents.license.status !== 'not_uploaded' ? 'existing-front.jpg' : '',
        licenseBackName: '',
        licenseNumber: driver.documents.license.number ?? '',
        licenseExpiry: driver.documents.license.expiryDate ?? '',
        plateImageName: driver.documents.plate.status !== 'not_uploaded' ? 'existing-plate.jpg' : '',
        plateNumber: driver.documents.plate.number ?? '',
        licenseFrontFile: null,
        licenseBackFile: null,
        plateImageFile: null,
      });
    } else {
      setValues(emptyForm);
    }
    setErrors({});
  }, [open, driver]);

  // On edit, fetch the driver's document detail (image URLs + rejection reasons)
  // which the list endpoint doesn't include.
  useEffect(() => {
    setDocDetail(null);
    if (!open || !driver) return;
    let cancelled = false;
    (async () => {
      const detail = await driversApi.get(driver.id);
      if (!cancelled && detail) setDocDetail(detail.documents);
    })();
    return () => { cancelled = true; };
  }, [open, driver]);

  const update = <K extends keyof DriverFormValues>(key: K, val: DriverFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Capture both the File (for upload) and its name (for display).
  const selectFile = (
    fileKey: 'licenseFrontFile' | 'licenseBackFile' | 'plateImageFile',
    nameKey: 'licenseFrontName' | 'licenseBackName' | 'plateImageName',
    file: File,
  ) => {
    setValues((v) => ({ ...v, [fileKey]: file, [nameKey]: file.name }));
  };

  /** "Enter a valid Jordan mobile number (e.g. 791234567)" — from the country's own facts. */
  const invalidPhoneMessage = (c: Country): string => {
    const name    = locale === 'ar' ? c.nameAr : c.nameEn;
    const example = c.phoneExampleNational || c.phonePlaceholder;
    return example
      ? t('drivers.phoneInvalidForCountry', { country: name, example })
      : t('drivers.phoneInvalidForCountryShort', { country: name });
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!values.fullName.trim()) next.fullName = t('drivers.fullNameRequired');
    if (!values.phone.trim()) next.phone = t('drivers.phoneRequired');
    // The rule is the country's, from GET /countries — never a regex written here.
    else if (country && !matchesPhoneRegex(values.phone.trim(), country.phoneRegex)) {
      next.phone = invalidPhoneMessage(country);
    }
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) next.email = t('drivers.emailInvalid');

    // Without a country there is no dial code, and a number sent without one is
    // the exact defect this change removes. Say so rather than posting a bare
    // national number that only resolves correctly in Saudi Arabia.
    const countryProblem = country
      ? null
      : countryPending
        ? t('common.loading')
        : t('drivers.countryUnresolved');
    setCountryError(countryProblem);

    setErrors(next);
    return Object.keys(next).length === 0 && countryProblem === null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    setCountryError(null);
    try {
      await onSubmit(values, driver?.id);
      onClose();
    } catch (err) {
      // country_not_supported / phone_invalid_for_country are input mistakes, not
      // failures of the request: they belong beside the field the operator has to
      // fix, never in the form-wide banner.
      const fieldError = fieldErrorFrom(err);
      if (fieldError) {
        const detail  = fieldError.expectedFormat ?? fieldError.example;
        const message = detail ? `${fieldError.message} (${detail})` : fieldError.message;
        if (fieldError.field === 'country') setCountryError(message);
        else setErrors((prev) => ({ ...prev, phone: message }));
      } else {
        setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const existingDocStatus = isEdit ? driver!.documents : null;

  // Plate identifies the machine; the model is the fallback when the list row
  // carried no plate. Empty on create — nothing is assigned yet.
  const assignedVehicleLabel = [driver?.assignedMotorcyclePlate, driver?.vehicleModel]
    .filter(Boolean)
    .join(' · ');

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

          {/* API error banner */}
          {submitError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

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

            {/* Country — the fleet's, read-only. Fleets do not span countries. */}
            <Field
              label={t('drivers.country')}
              error={countryError ?? undefined}
              hint={country ? t('drivers.countryFixedByFleet') : undefined}
            >
              <div
                className={cn(
                  'flex h-11 w-full items-center gap-2 rounded-xl border bg-slate-50 px-3.5 text-sm dark:bg-slate-800/60',
                  countryError ? 'border-rose-400' : '',
                )}
                style={!countryError ? { borderColor: 'rgb(var(--border))' } : undefined}
              >
                {country ? (
                  <>
                    <span aria-hidden>{flagEmoji(country.isoCountryCode)}</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                      {locale === 'ar' ? country.nameAr : country.nameEn}
                    </span>
                    <span className="text-xs text-slate-400" dir="ltr">{country.dialCode}</span>
                    <Lock className="ms-auto h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  </>
                ) : (
                  <span className="text-slate-400">
                    {countryPending ? t('common.loading') : t('drivers.countryUnresolved')}
                  </span>
                )}
              </div>
            </Field>

            <Field label={t('drivers.phoneNumber')} required error={errors.phone}>
              <div
                className={cn(
                  'flex h-11 w-full overflow-hidden rounded-xl border bg-white transition-colors',
                  'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20',
                  'dark:bg-slate-900/40',
                  errors.phone ? 'border-rose-400' : ''
                )}
                style={!errors.phone ? { borderColor: 'rgb(var(--border))' } : undefined}
              >
                {/* Dial prefix — the fleet's country, not a hardcoded +966 */}
                <div
                  className="flex shrink-0 items-center gap-1.5 border-e bg-slate-50 px-3 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  dir="ltr"
                >
                  <span aria-hidden>{flagEmoji(country?.isoCountryCode)}</span>
                  <span>{country?.dialCode ?? '—'}</span>
                </div>
                {/* National number, sized and validated by the country */}
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={country?.phonePlaceholder || ''}
                  value={values.phone}
                  dir="ltr"
                  onChange={(e) => {
                    // Paste-tolerant: "+962 79 123 4567" reduces to its national
                    // digits instead of being truncated mid-prefix. The length cap
                    // lives here rather than in maxLength, which would clip the
                    // pasted text before it could be normalised.
                    const national = toNationalNumber(e.target.value, country?.dialCode);
                    update('phone', national.slice(0, country?.nationalNumberLength || 15));
                    if (countryError) setCountryError(null);
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-700 outline-none dark:text-slate-200"
                />
              </div>
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
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`${t('drivers.address')} (${t('common.optional')})`}>
              <Input
                placeholder="Al Olaya, Riyadh"
                value={values.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </Field>
            <Field label={`${t('drivers.city')} (${t('common.optional')})`}>
              <Input
                placeholder="Riyadh"
                value={values.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </Field>
          </div>

          {/* ── Vehicle Assignment ───────────────────────────────────────── */}
          {/*
            Read-only on purpose. This was a dropdown of hardcoded model names
            whose value this form had no endpoint to save. Assignment is a
            motorcycle id sent to POST /fleet-admin/motorcycles/{id}/assign-driver
            — the "Assign Vehicle" action in the drivers table.
          */}
          <div className="mt-6">
            <SectionHeader icon={<Car className="h-4 w-4" />} title={t('drivers.vehicleAssignment')} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4">
            <Field
              label={t('drivers.assignedVehicle')}
              hint={t('drivers.assignVehicleElsewhere')}
            >
              <div
                className="flex h-11 w-full items-center gap-2 rounded-xl border bg-slate-50 px-3.5 text-sm dark:bg-slate-800/60"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                {assignedVehicleLabel ? (
                  <>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                      {assignedVehicleLabel}
                    </span>
                    <Lock className="ms-auto h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  </>
                ) : (
                  <span className="text-slate-400">{t('drivers.noVehicleAssigned')}</span>
                )}
              </div>
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
                    onFileSelect={(f) => selectFile('licenseFrontFile', 'licenseFrontName', f)}
                    accept="image/*"
                  />
                  <FileUploadBox
                    label={`${t('drivers.licenseBack')} (${t('common.optional')})`}
                    fileName={values.licenseBackName}
                    onFileSelect={(f) => selectFile('licenseBackFile', 'licenseBackName', f)}
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
                {docDetail?.license && (
                  <DocPreviewNote
                    status={docDetail.license.status}
                    fileUrl={docDetail.license.fileUrl}
                    backFileUrl={docDetail.license.backFileUrl}
                    rejectionReason={docDetail.license.rejectionReason}
                  />
                )}
              </div>
            )}
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
                onFileSelect={(f) => selectFile('plateImageFile', 'plateImageName', f)}
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
            {docDetail?.plate && (
              <DocPreviewNote
                status={docDetail.plate.status}
                fileUrl={docDetail.plate.fileUrl}
                rejectionReason={docDetail.plate.rejectionReason}
              />
            )}
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
  label, required, error, hint, children,
}: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
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

/** Shows the currently-stored document image link(s) and any rejection reason. */
function DocPreviewNote({
  status, fileUrl, backFileUrl, rejectionReason,
}: {
  status: DocumentStatus;
  fileUrl?: string;
  backFileUrl?: string;
  rejectionReason?: string;
}) {
  const { t } = useI18n();
  if (!fileUrl && !backFileUrl && !(status === 'rejected' && rejectionReason)) return null;

  return (
    <div className="mt-3 space-y-2">
      {(fileUrl || backFileUrl) && (
        <div className="flex flex-wrap items-center gap-3">
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {t('drivers.viewCurrentImage')}
            </a>
          )}
          {backFileUrl && (
            <a
              href={backFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {t('drivers.viewBackImage')}
            </a>
          )}
        </div>
      )}
      {status === 'rejected' && rejectionReason && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="font-semibold">{t('drivers.rejectionReason')}:</span> {rejectionReason}
        </p>
      )}
    </div>
  );
}

function FileUploadBox({
  label, fileName, onFileSelect, accept = 'image/*,.pdf',
}: {
  label: string; fileName: string; onFileSelect: (file: File) => void; accept?: string;
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
          if (file) onFileSelect(file);
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
