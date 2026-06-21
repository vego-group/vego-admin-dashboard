/**
 * Centralised HTTP client for the MyVego Fleet Admin API.
 *
 * Every request automatically attaches the Bearer token that is stored in
 * the Zustand auth store (persisted to localStorage under "myvego.auth").
 *
 * Configure the backend URL in .env.local:
 *   NEXT_PUBLIC_API_URL=https://your-backend.com/api
 */

import { logger } from '@/lib/logger';

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

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    logger.warn('[apiClient] NEXT_PUBLIC_API_URL is not set — requests will fail.');
    throw new ApiNotConfiguredError();
  }

  const token = getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch (networkErr) {
    // Network-level failure (no connection, CORS preflight rejected, DNS error, …)
    const msg =
      networkErr instanceof Error ? networkErr.message : 'Network error';
    throw new ApiError(0, `Network error: ${msg}`);
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore JSON parse failures — keep the status-code message
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content — return undefined rather than trying to parse an empty body
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

export const apiClient = {
  get:    <T>(path: string)               => request<T>(path),
  post:   <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST',   body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch:  <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH',  body: body !== undefined ? JSON.stringify(body) : undefined }),
  put:    <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT',    body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
};
