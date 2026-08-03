"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@examora/ui";

type Health = "checking" | "operational" | "unavailable";

/** Reuses the real /health/live endpoint (Sprint 13) rather than a hardcoded "operational" claim. */
function useSystemHealth(): Health {
  const [health, setHealth] = React.useState<Health>("checking");

  React.useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";
    fetch(`${origin}/health/live`, { cache: "no-store" })
      .then((res) => setHealth(res.ok ? "operational" : "unavailable"))
      .catch(() => setHealth("unavailable"));
  }, []);

  return health;
}

export function DashboardFooter() {
  const health = useSystemHealth();

  return (
    <footer role="contentinfo" className="mt-4 border-t border-neutral-900/[0.06] py-6">
      <div className="flex flex-col items-center justify-between gap-3 text-xs text-neutral-400 sm:flex-row">
        <span>Examora v1.0.0</span>
        <div className="flex items-center gap-4">
          <Link href="/faq" className="hover:text-neutral-600 hover:underline">
            Help &amp; Support
          </Link>
        </div>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              health === "operational" && "bg-success-500",
              health === "unavailable" && "bg-neutral-300",
              health === "checking" && "bg-neutral-200",
            )}
          />
          {health === "operational"
            ? "All systems operational"
            : health === "unavailable"
              ? "Status unavailable"
              : "Checking status…"}
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-neutral-300 sm:text-left">
        © 2026 Examora. All rights reserved.
      </p>
    </footer>
  );
}
