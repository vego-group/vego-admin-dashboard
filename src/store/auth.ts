import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

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

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingPhone: string | null;

  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

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
    try {
      const json = (await res.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
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

      // ── Step 1: send OTP ────────────────────────────────────────────────────
      sendOtp: async (phone) => {
        set({ isLoading: true, error: null });
        try {
          await authFetch<LoginResponse>('/super-admin/login', { phone });
          set({ pendingPhone: phone, isLoading: false });
          return true;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to send OTP',
            isLoading: false,
          });
          return false;
        }
      },

      // ── Step 2: verify OTP ──────────────────────────────────────────────────
      verifyOtp: async (otp) => {
        const { pendingPhone } = get();
        if (!pendingPhone) {
          set({ error: 'No pending phone number', isLoading: false });
          return false;
        }

        set({ isLoading: true, error: null });
        try {
          const res = await authFetch<VerifyOtpResponse>('/super-admin/verify-otp', {
            phone: pendingPhone,
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
          return true;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Invalid OTP code. Please try again.',
            isLoading: false,
          });
          return false;
        }
      },

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
      }),
    }
  )
);
