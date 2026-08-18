import type * as React from "react";
import { cn } from "@examora/ui";

const CHIP_TONES = {
  neutral: "bg-neutral-100 text-neutral-600",
  primary: "bg-primary-50 text-primary-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  success: "bg-success-50 text-success-700",
  accent: "bg-accent-50 text-accent-700",
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

/** Status/tag pill. Mirrors apps/web's Chip exactly — same tone palette, same shape. */
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
