'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n/I18nProvider';
import { billingAddressErrorsFrom, walletApi, type BillingAddressField } from '@/lib/api';
import type { BillingAddress } from '@/types';

/** HyperPay's parameter limits (`billing.street1`, `billing.city`, `billing.state`). */
const MAX_LENGTH: Record<Exclude<BillingAddressField, 'postcode'>, number> = {
  street: 100,
  city:   48,
  state:  40,
};

/** Jordanian postcodes are five digits; Arabic-Indic digits are accepted and normalised. */
function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

interface BillingAddressFormProps {
  initial?: BillingAddress | null;
  submitLabel: string;
  onSaved: (address: BillingAddress) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * The fleet's billing address — street, city, governorate, postcode. There is
 * no country field: the server sets it (JO). Saves through
 * `PUT /fleet-admin/billing-address` and reports the saved address.
 */
export function BillingAddressForm({ initial, submitLabel, onSaved, onCancel, cancelLabel }: BillingAddressFormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<BillingAddressField, string>>({
    street:   initial?.street   ?? '',
    city:     initial?.city     ?? '',
    state:    initial?.state    ?? '',
    postcode: initial?.postcode ?? '',
  });
  const [errors, setErrors]       = useState<Partial<Record<BillingAddressField, string>>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const set = (field: BillingAddressField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((errs) => ({ ...errs, [field]: undefined }));
    if (formError) setFormError('');
  };

  const validate = (): boolean => {
    const next: Partial<Record<BillingAddressField, string>> = {};
    for (const field of ['street', 'city', 'state'] as const) {
      if (!values[field].trim()) next[field] = t('wallet.billingFieldRequired');
    }
    const postcode = toAsciiDigits(values.postcode.trim());
    if (!postcode) next.postcode = t('wallet.billingFieldRequired');
    else if (!/^\d{5}$/.test(postcode)) next.postcode = t('wallet.billingPostcodeInvalid');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setFormError('');
    try {
      const saved = await walletApi.saveBillingAddress({
        street:   values.street.trim(),
        city:     values.city.trim(),
        state:    values.state.trim(),
        postcode: toAsciiDigits(values.postcode.trim()),
      });
      onSaved(saved);
    } catch (err) {
      const fieldErrors = billingAddressErrorsFrom(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        const message = err instanceof Error ? err.message : '';
        setFormError(message && !/^HTTP \d{3}$/.test(message) ? message : t('wallet.billingSaveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (
    name: BillingAddressField,
    label: string,
    placeholder: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`billing-${name}`} className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label} <span className="text-rose-500">*</span>
      </label>
      <Input
        id={`billing-${name}`}
        name={name}
        value={values[name]}
        onChange={set(name)}
        placeholder={placeholder}
        aria-invalid={!!errors[name]}
        className={errors[name] ? '!border-rose-400' : undefined}
        {...extra}
      />
      {errors[name] && <p className="mt-1 text-xs text-rose-600">{errors[name]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {field('street', t('wallet.billingStreet'), t('wallet.billingStreetPlaceholder'), {
        maxLength: MAX_LENGTH.street, autoComplete: 'address-line1',
      })}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('city', t('wallet.billingCity'), t('wallet.billingCityPlaceholder'), {
          maxLength: MAX_LENGTH.city, autoComplete: 'address-level2',
        })}
        {field('state', t('wallet.billingState'), t('wallet.billingStatePlaceholder'), {
          maxLength: MAX_LENGTH.state, autoComplete: 'address-level1',
        })}
      </div>
      <div className="sm:w-1/2 sm:pe-2">
        {field('postcode', t('wallet.billingPostcode'), t('wallet.billingPostcodePlaceholder'), {
          inputMode: 'numeric', maxLength: 5, autoComplete: 'postal-code', dir: 'ltr',
        })}
      </div>

      {formError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="min-w-[90px]">
            {cancelLabel ?? t('common.cancel')}
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={saving} className="min-w-[140px]">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
