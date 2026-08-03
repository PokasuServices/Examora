import type { LucideIcon } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  icon,
  tone = "primary",
  label,
  value,
  trend,
  accessibleLabel,
}: {
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "accent";
  label: string;
  value: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  accessibleLabel: string;
}) {
  return (
    <Card aria-label={accessibleLabel}>
      <IconBadge icon={icon} tone={tone} />
      <p className="mt-4 text-xs font-medium text-neutral-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-heading text-3xl font-bold tabular-nums leading-none text-neutral-900">
          {value}
        </p>
        {trend ? <TrendChip direction={trend.direction} label={trend.label} /> : null}
      </div>
    </Card>
  );
}

export function StatCardSkeletonTile() {
  return (
    <Card>
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-2 h-8 w-16" />
    </Card>
  );
}

export function StatCardErrorTile({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <Card className="group">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="font-heading text-3xl font-bold text-neutral-300">—</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-medium text-primary-600 opacity-0 hover:underline focus-visible:opacity-100 group-hover:opacity-100"
        >
          Retry
        </button>
      </div>
    </Card>
  );
}
