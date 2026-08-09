import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { HealthCheckResult } from "@/lib/admin-dashboard-api";

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function HealthChip({ health }: { health: HealthCheckResult | null }) {
  if (!health) {
    return <Chip tone="neutral">Checking system status…</Chip>;
  }
  if (health.status === "ok") {
    return (
      <Chip tone="success" className="gap-1.5">
        <CheckCircle2 size={13} strokeWidth={2} aria-hidden="true" />
        All systems operational
      </Chip>
    );
  }
  return (
    <Chip tone="danger" className="gap-1.5">
      <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
      Degraded — check system health
    </Chip>
  );
}

export function ExecutiveHero({
  name,
  health,
}: {
  name: string;
  health: HealthCheckResult | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-neutral-500">
          <Activity size={15} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide">Executive dashboard</span>
        </div>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{TODAY}</p>
      </div>
      <HealthChip health={health} />
    </div>
  );
}
