/**
 * Which failures belong on a form field rather than on the page.
 *
 * Three 422s are ordinary input mistakes and must be treated as such:
 *
 *   country_not_supported      the selected country is not a live market
 *   phone_invalid_for_country  the number does not match that country's rule
 *   a blank `name` or `phone`  neither is clearable — the backend refuses a
 *                              blank one by name rather than wiping the column
 *
 * None is an auth failure. None means the session is gone. They must not sign
 * the operator out, must not surface as a page-level banner, and must not be
 * swallowed by a catch that turns everything into "something went wrong" — the
 * operator needs to know *which field* to fix, and the backend already said
 * which one in `error_code` or in `errors`.
 *
 * Everything else stays global: a 500 is not a phone-number problem.
 */

import { ApiError } from '@/lib/api/client';

/** The form fields these errors can land on. */
export type FormFieldName = 'country' | 'phone' | 'name';

export interface FieldError {
  field: FormFieldName;
  /** Backend `error_code`, or a synthetic 'validation' for Laravel field errors. */
  code: string;
  /** The backend's own message — already human-readable. */
  message: string;
  /** The mask the backend expects, from `meta.expected_format`. */
  expectedFormat?: string;
  /** A valid example number, from `meta.example`. */
  example?: string;
  /** Live markets, from `meta.supported`. */
  supported?: string[];
}

const FIELD_BY_ERROR_CODE: Record<string, FormFieldName> = {
  country_not_supported: 'country',
  phone_invalid_for_country: 'phone',
};

/** Request field names Laravel may report a validation error against. */
const FIELD_BY_REQUEST_KEY: Record<string, FormFieldName> = {
  phone: 'phone',
  country_code: 'country',
  iso_country_code: 'country',
  country: 'country',
  // `name` is not clearable: a blank one comes back as a 422 against this key.
  name: 'name',
};

function readString(meta: Record<string, unknown> | null, key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function readStringList(meta: Record<string, unknown> | null, key: string): string[] | undefined {
  const value = meta?.[key];
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === 'string');
  return list.length ? list : undefined;
}

/**
 * Classify an error thrown by the API layer.
 *
 * Returns the field it belongs to, or **null** when the caller should handle it
 * as it handles any other failure.
 */
export function fieldErrorFrom(err: unknown): FieldError | null {
  if (!(err instanceof ApiError)) return null;

  // 1. The backend's own error_code — the authoritative signal.
  const byCode = err.code ? FIELD_BY_ERROR_CODE[err.code] : undefined;
  if (byCode) {
    return {
      field: byCode,
      code: err.code as string,
      message: err.message,
      expectedFormat: readString(err.meta, 'expected_format'),
      example: readString(err.meta, 'example'),
      supported: readStringList(err.meta, 'supported') ?? readStringList(err.meta, 'supported_countries'),
    };
  }

  // 2. Laravel's per-field validator, for the routes that reject before the
  //    country rules run at all.
  if (err.status === 422 && err.errors) {
    for (const [key, messages] of Object.entries(err.errors)) {
      const field = FIELD_BY_REQUEST_KEY[key];
      if (field && messages?.length) {
        return { field, code: 'validation', message: messages[0] };
      }
    }
  }

  return null;
}

/** True when this failure belongs on a field and must stay off the page. */
export function isFieldLevelError(err: unknown): boolean {
  return fieldErrorFrom(err) !== null;
}
