/**
 * Centralised HTTP client for the MyVego Fleet Admin API.
 *
 * Every request automatically attaches the Bearer token that is stored in
 * the Zustand auth store (persisted to localStorage under "myvego.auth").
 *
 * Configure the backend URL in .env.local:
 *   NEXT_PUBLIC_API_URL=https://your-backend.com/api
 */

import { readStoredLocale } from '@/i18n/locale-storage';
import { logger } from '@/lib/logger';
import type { Locale } from '@/types';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// Lazily read the token so we never import the store at module-load time,
// which would create a circular dependency.
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('myvego.auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * The UI language, sent as `Accept-Language` on every request so the backend
 * answers in it — validation messages included. Read per request, like the
 * token, so a language switch applies to the next call without a reload.
 *
 * `Accept-Language` only: it is a CORS-safelisted header. `X-Locale`, which the
 * backend also reads, is not, and would need a backend CORS change.
 */
export function requestLanguage(): Locale {
  if (typeof document === 'undefined') return 'en';
  return readStoredLocale() ?? (document.documentElement.lang === 'ar' ? 'ar' : 'en');
}

/**
 * The machine-readable half of an error response.
 *
 * The backend answers a rejected request with
 * `{ success: false, error_code: "phone_invalid_for_country", meta: {…} }`, and
 * Laravel's own validator answers with `{ message, errors: { phone: [...] } }`.
 * Both carry enough to decide whether a failure belongs on one form field or on
 * the page, so both are parsed — a 422 that is really "this phone is wrong" must
 * never reach the global error surface. See @/lib/api-errors.
 */
export interface ApiErrorBody {
  message?: string;
  error_code?: string;
  code?: string;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  /** Backend `error_code`, e.g. 'country_not_supported'. Null when absent. */
  public readonly code: string | null;
  /** Backend `meta` — expected_format, example, supported, … */
  public readonly meta: Record<string, unknown> | null;
  /** Laravel per-field validation messages, keyed by request field name. */
  public readonly errors: Record<string, string[]> | null;

  constructor(
    public readonly status: number,
    message: string,
    body?: ApiErrorBody | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code   = body?.error_code ?? body?.code ?? null;
    this.meta   = body?.meta ?? null;
    this.errors = body?.errors ?? null;
  }
}

// ── Expired sessions ─────────────────────────────────────────────────────────
//
// A 401 means the session is gone: the token expired or was revoked. The auth
// store registers what to do about it (sign out, which sends the operator to
// the login page with a "session expired" message) — registered rather than
// imported, because the store imports this module.
//
// Requests already in flight answer 401 too. The store only acts while it is
// still signed in, so a page that fires six requests signs out, and
// redirects, once.

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function handleUnauthorized(sentToken: string | null): void {
  // Sent with an older token than the stored one: that session was already
  // replaced by a new sign-in, which this 401 says nothing about.
  if (sentToken !== getToken()) return;
  onUnauthorized?.();
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      'API URL is not configured. ' +
      'Add NEXT_PUBLIC_API_URL=https://your-backend.com/api to your .env.local file.',
    );
    this.name = 'ApiNotConfiguredError';
  }
}

// ── Timeouts (FA-419) ─────────────────────────────────────────────────────────
//
// Every request is aborted after a deadline, so nothing spins forever. A timed
// out request throws ApiError(0) with `code === REQUEST_TIMEOUT_CODE`, which
// the payment screens treat like a network error: the outcome is unknown —
// "check the wallet ledger", never "failed".

/** Default deadline for any API call. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Payment calls — initiate, charge-saved, verify — may wait on the gateway. */
export const PAYMENT_TIMEOUT_MS = 60_000;
/** Multipart uploads (driver documents) carry files over slow links. */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** `ApiError.code` of a request that hit its deadline. */
export const REQUEST_TIMEOUT_CODE = 'request_timeout';

export interface RequestOptions {
  /** Abort after this many ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Extra request headers, e.g. `Idempotency-Key`. */
  headers?: Record<string, string>;
}

/** True when the request hit its deadline. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0 && err.code === REQUEST_TIMEOUT_CODE;
}

/**
 * True when a failed call says nothing about what the server did: no answer at
 * all (network, timeout), a server error (5xx), 408/429, a 401 (the session
 * ended, not the request), or a success status whose body could not be read.
 * For a payment call this means "may have gone through": the caller must not
 * say it failed.
 */
export function isIndeterminateFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 408 || err.status === 429;
  }
  // `res.json()` on a 2xx answer that is not JSON.
  return err instanceof SyntaxError;
}

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  if (!BASE_URL) {
    logger.warn('[apiClient] NEXT_PUBLIC_API_URL is not set — requests will fail.');
    throw new ApiNotConfiguredError();
  }

  const token = getToken();

  // For FormData, let the browser set Content-Type (with the multipart boundary).
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': requestLanguage(),
    ...(init.body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
    ...options.headers,
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // The deadline covers the whole exchange, body included.
  const timeoutMs  = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut   = () => new ApiError(
    0,
    `The server did not answer within ${Math.round(timeoutMs / 1000)} s.`,
    { error_code: REQUEST_TIMEOUT_CODE },
  );

  try {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: controller.signal });
    } catch (networkErr) {
      if (controller.signal.aborted) throw timedOut();
      // Network-level failure (no connection, CORS preflight rejected, DNS error, …)
      const msg =
        networkErr instanceof Error ? networkErr.message : 'Network error';
      throw new ApiError(0, `Network error: ${msg}`);
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let body: ApiErrorBody | null = null;
      try {
        body = (await res.json()) as ApiErrorBody;
        if (body.message) message = body.message;
      } catch {
        // ignore JSON parse failures — keep the status-code message
      }
      // A 403 is not this: the session is valid, the account may not see the data.
      if (res.status === 401) handleUnauthorized(token);
      throw new ApiError(res.status, message, body);
    }

    // 204 No Content — return undefined rather than trying to parse an empty body
    if (res.status === 204) return undefined as unknown as T;

    try {
      return (await res.json()) as T;
    } catch (parseErr) {
      if (controller.signal.aborted) throw timedOut();
      throw parseErr;
    }
  } finally {
    clearTimeout(timer);
  }
}

const json = (body: unknown) => (body !== undefined ? JSON.stringify(body) : undefined);

export const apiClient = {
  get:    <T>(path: string, options?: RequestOptions) => request<T>(path, {}, options),
  post:   <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: json(body) }, options),
  /** POST multipart/form-data — pass a FormData; the browser sets the boundary header. */
  postForm: <T>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: form }, { timeoutMs: UPLOAD_TIMEOUT_MS, ...options }),
  patch:  <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body: json(body) }, options),
  put:    <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: json(body) }, options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', body: json(body) }, options),
};
