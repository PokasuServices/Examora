import type { LucideIcon } from "lucide-react";
import { cn } from "@examora/ui";

const TONES = {
  primary: "bg-primary-500/10 text-primary-600 dark:text-primary-400",
  success: "bg-success-500/10 text-success-600 dark:text-success-400",
  warning: "bg-warning-500/10 text-warning-600 dark:text-warning-400",
  danger: "bg-danger-500/10 text-danger-600 dark:text-danger-400",
  accent: "bg-accent-500/10 text-accent-600 dark:text-accent-400",
  neutral: "bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400",
} as const;

/** Soft-tinted circular icon background. Mirrors apps/web's IconBadge exactly. */
export function IconBadge({
  icon: Icon,
  tone = "neutral",
  size = 32,
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: 24 | 32;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === 32 ? "h-8 w-8" : "h-6 w-6",
        TONES[tone],
        className,
      )}
    >
      <Icon size={size === 32 ? 18 : 14} strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
