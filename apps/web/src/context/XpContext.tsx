"use client";

import * as React from "react";
import type { XpSummary } from "@examora/types";
import { useXpApi } from "@/lib/xp-api";

interface XpContextValue {
  /** null until the first load finishes (or if it failed). */
  xp: XpSummary | null;
  /** Re-reads the total, e.g. after a lesson or quiz awards XP. */
  refresh: () => Promise<void>;
}

const XpContext = React.createContext<XpContextValue | null>(null);

export function XpProvider({ children }: { children: React.ReactNode }) {
  const api = useXpApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [xp, setXp] = React.useState<XpSummary | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setXp(await apiRef.current.getMyXp());
    } catch {
      // Leave the last known value; the sidebar simply shows no XP figure.
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo(() => ({ xp, refresh }), [xp, refresh]);
  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

const NO_XP: XpContextValue = { xp: null, refresh: async () => {} };

/** XP for the student shell. Outside it (e.g. staff previewing a student page) there is no XP to show. */
export function useXp(): XpContextValue {
  return React.useContext(XpContext) ?? NO_XP;
}
