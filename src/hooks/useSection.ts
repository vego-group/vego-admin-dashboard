'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

/**
 * One independently loaded part of a page: a KPI row, a chart, a map layer.
 *
 * Each part fails on its own and says so on its own (FA-312, FA-313). A page
 * that awaited all of them together, or that dropped a failure into a log and
 * kept its zero-filled defaults, showed a failed request as "nothing happened"
 * — or never stopped loading.
 */
export interface Section<T> {
  /** The last successful result; undefined until one arrives. */
  data: T | undefined;
  /** Why the last attempt failed; undefined when it did not. */
  error: unknown;
  /** True while a request is in flight (the first one, or a retry). */
  loading: boolean;
  /** Ask again. */
  retry: () => void;
}

/**
 * Load `load()` once on mount, and again on `retry()`.
 *
 * `load` may be a fresh closure on every render; the latest one is used when a
 * request starts, and it never triggers a request by itself changing.
 * `label` names the part in the log.
 */
export function useSection<T>(label: string, load: () => Promise<T>): Section<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        logger.error(`${label} failed:`, error);
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
      },
    );
    return () => { cancelled = true; };
  }, [attempt, label]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
