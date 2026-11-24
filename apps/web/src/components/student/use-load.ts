"use client";

import * as React from "react";

export interface LoadState<T> {
  data: T | null;
  /** HTTP status of the failure (e.g. 403 = no licence, 404 = not found), or 0 for a network error. */
  errorStatus: number | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fn` on mount and whenever `key` changes; keeps the latest result.
 * `fn` is read through a ref, so callers can pass an inline closure.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string | null): LoadState<T> {
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  const [data, setData] = React.useState<T | null>(null);
  const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setLoading(true);
    setErrorStatus(null);
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: unknown })?.status;
        setErrorStatus(typeof status === "number" ? status : 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data, errorStatus, loading, reload };
}
