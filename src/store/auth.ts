import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError } from '@/lib/api/client';
import { fieldErrorFrom, type FieldError } from '@/lib/api-errors';
import { toE164 } from '@/lib/country';
import type { DialCode, IsoCountryCode, User } from '@/types';

// ── Raw API shapes ────────────────────────────────────────────────────────────

interface LoginResponse {
  message?: string;
}

interface VerifyOtpResponse {
  token: string;
  user?: {
    id: number | string;
    name: string;
    email: string;
    role?: string;
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

/** The market this operator signs in to. Persisted, so re-login pre-selects it. */
export interface LoginCountry {
  isoCountryCode: IsoCountryCode;
  dialCode: DialCode;
}

export interface SendOtpInput {
  /** National number — the digits after the dial code, no trunk `0`. */
  phone: string;
  country: LoginCountry;
}

/**
 * Outcome of an auth call.
 *
 * `fieldError` is set when the backend rejected an *input* — an unsupported
 * country or a number that does not match it. Those never touch the store's
 * `error`, are never a reason to sign out, and are the caller's to render next
 * to the offending field. Everything else lands in `error` as before.
 */
export interface AuthResult {
  ok: boolean;
  fieldError?: FieldError;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** National number awaiting an OTP. In memory only — never persisted. */
  pendingPhone: string | null;
  /** The country the phone belongs to. Persisted across sessions. */
  loginCountry: LoginCountry | null;

  setLoginCountry: (country: LoginCountry) => void;
  sendOtp: (input: SendOtpInput) => Promise<AuthResult>;
  verifyOtp: (otp: string) => Promise<AuthResult>;
  signOut: () => void;
  clearError: () => void;
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * Auth calls run outside the shared apiClient because they are the calls that
 * *produce* the token — but they throw the same {@link ApiError}, so
 * `error_code` and `meta` are available to classify the failure exactly as
 * anywhere else in the app.
 */
async function authFetch<T>(path: string, body: Record<string, string>): Promise<T> {
  if (!BASE_URL) {
    throw new Error('API URL is not configured. Please set NEXT_PUBLIC_API_URL in your .env.local file.');
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot connect to the server. Please check your network connection.');
  }

  if (!res.ok) {
    let message = `Server error (${res.status})`;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = (await res.json()) as Record<string, unknown>;
      if (typeof parsed?.['message'] === 'string') message = parsed['message'] as string;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message, parsed);
  }

  return res.json() as Promise<T>;
}

/**
 * Split a thrown error into "belongs on a field" and "belongs on the page".
 *
 * A `country_not_supported` or `phone_invalid_for_country` 422 is a typo, not a
 * failed session: it must leave `error` untouched so no global banner appears,
 * and it must never reach `signOut`.
 */
function toAuthResult(err: unknown, fallbackMessage: string): {
  result: AuthResult;
  globalError: string | null;
} {
  const fieldError = fieldErrorFrom(err);
  if (fieldError) {
    return { result: { ok: false, fieldError }, globalError: null };
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return { result: { ok: false }, globalError: message };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      pendingPhone: null,
      loginCountry: null,

      setLoginCountry: (country) => set({ loginCountry: country }),

      // ── Step 1: send OTP ────────────────────────────────────────────────────
      //
      // Sends `{ country_code, phone }` with the phone in full E.164. Until now
      // this posted a bare 9-digit number with no country code at all, which
      // could only ever resolve to a Saudi account.
      sendOtp: async ({ phone, country }) => {
        set({ isLoading: true, error: null, loginCountry: country });

        const e164 = toE164(phone, country.dialCode);
        try {
          await authFetch<LoginResponse>('/super-admin/login', {
            country_code: country.dialCode,
            phone: e164,
          });
          set({ pendingPhone: phone, isLoading: false });
          return { ok: true };
        } catch (err) {
          const { result, globalError } = toAuthResult(err, 'Failed to send OTP');
          set({ error: globalError, isLoading: false });
          return result;
        }
      },

      // ── Step 2: verify OTP ──────────────────────────────────────────────────
      //
      // Sends the same number in full E.164 — the backend repairs legacy shapes,
      // but this app stops producing them.
      verifyOtp: async (otp) => {
        const { pendingPhone, loginCountry } = get();
        if (!pendingPhone || !loginCountry) {
          set({ error: 'No pending phone number', isLoading: false });
          return { ok: false };
        }

        set({ isLoading: true, error: null });
        try {
          const res = await authFetch<VerifyOtpResponse>('/super-admin/verify-otp', {
            phone: toE164(pendingPhone, loginCountry.dialCode),
            code: otp,
          });

          const user: User = {
            id: String(res.user?.id ?? 'admin'),
            name: res.user?.name ?? 'Fleet Admin',
            email: res.user?.email ?? '',
            role: 'admin',
          };

          set({
            token: res.token,
            user,
            isAuthenticated: true,
            isLoading: false,
            pendingPhone: null,
          });
          return { ok: true };
        } catch (err) {
          const { result, globalError } = toAuthResult(err, 'Invalid OTP code. Please try again.');
          set({ error: globalError, isLoading: false });
          return result;
        }
      },

      // The country choice survives sign-out on purpose: it is a preference, not
      // a credential, and re-login should not ask for it again.
      signOut: () =>
        set({ user: null, token: null, isAuthenticated: false, error: null, pendingPhone: null }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'myvego.auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        loginCountry: state.loginCountry,
      }),
    }
  )
);
