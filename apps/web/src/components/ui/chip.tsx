import type * as React from "react";
import { cn } from "@examora/ui";

const CHIP_TONES = {
  neutral: "bg-neutral-100 text-neutral-600",
  primary: "bg-primary-50 text-primary-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  success: "bg-success-50 text-success-700",
  /** Reserved for AI-recommendation reason chips — see ReasonChip. Never used for anything else. */
  accent: "bg-accent-50 text-accent-700",
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        CHIP_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Due-date chip for Upcoming Activities — text always spells out the state, color reinforces it. */
export function DueChip({ dueAt }: { dueAt: string }) {
  const due = new Date(dueAt);
  const now = new Date();
  const hoursUntil = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 0) {
    return <Chip tone="danger">Overdue</Chip>;
  }
  if (hoursUntil < 4) {
    return <Chip tone="warning">Due in {Math.max(1, Math.round(hoursUntil))}h</Chip>;
  }
  return (
    <Chip tone="neutral">
      Due{" "}
      {due.toLocaleDateString(undefined, {
        weekday: hoursUntil < 48 ? undefined : "short",
        month: "short",
        day: "numeric",
      })}
    </Chip>
  );
}

/** The AI Recommendation Engine's plain-English `reason` — the one place accent color + sparkle mean "recommended for you." */
export function ReasonChip({ reason }: { reason: string }) {
  return (
    <Chip tone="accent" className="max-w-full truncate">
      {reason}
    </Chip>
  );
}

export function TrendChip({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat";
  label: string;
}) {
  if (direction === "flat") {
    return <Chip tone="neutral">{label}</Chip>;
  }
  return <Chip tone={direction === "up" ? "success" : "danger"}>{label}</Chip>;
}
