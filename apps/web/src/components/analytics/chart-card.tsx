import type * as React from "react";
import { Card } from "@/components/ui/card";

/** Consistent chart wrapper — title/subtitle over a fixed-height plot area, reused by every trend/bar chart in Analytics. */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold text-neutral-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        {action ?? null}
      </div>
      <div className="mt-4 h-64">{children}</div>
    </Card>
  );
}
