"use client";

import * as React from "react";
import { useSettingsApi, type SessionSummary } from "@/lib/settings-api";

type Status = "loading" | "ready" | "error";

/** Shared by the Security tab's compact summary and the full Sessions tab — one fetch, one source of truth for /auth/sessions. */
export function useSessions() {
  const api = useSettingsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listSessions()
      .then((res) => {
        setSessions(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function revoke(id: string): Promise<void> {
    setBusyId(id);
    try {
      await api.revokeSession(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAll(): Promise<void> {
    setBusyId("all");
    try {
      await api.revokeAllSessions();
      load();
    } finally {
      setBusyId(null);
    }
  }

  const current = sessions.find((s) => s.isCurrent) ?? null;
  const others = sessions.filter((s) => !s.isCurrent);

  return { status, sessions, current, others, busyId, revoke, revokeAll, retry: load };
}
