import type * as React from "react";
import { cn } from "@examora/ui";

const CHIP_TONES = {
  neutral: "bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400",
  primary: "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300",
  warning: "bg-warning-50 dark:bg-warning-500/15 text-warning-700 dark:text-warning-300",
  danger: "bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-300",
  success: "bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-300",
  accent: "bg-accent-50 dark:bg-accent-500/15 text-accent-700 dark:text-accent-300",
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
