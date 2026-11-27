import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@examora/ui";

/**
 * Quiet colour coding for student cards: each kind of information keeps one
 * tone (e.g. lessons indigo, quizzes amber, danger rose) so pages are easy to
 * scan. Tints stay light (a soft wash, a 2px accent line), never loud.
 */
export type Tone = "indigo" | "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";

const TONES: Record<
  Tone,
  { card: string; line: string; icon: string; text: string; soft: string }
> = {
  indigo: {
    card: "border-indigo-100 from-indigo-50/90 dark:border-indigo-500/20 dark:from-indigo-500/10",
    line: "bg-indigo-500/80",
    icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    text: "text-indigo-700 dark:text-indigo-300",
    soft: "bg-indigo-50 dark:bg-indigo-500/10",
  },
  cyan: {
    card: "border-cyan-100 from-cyan-50/90 dark:border-cyan-500/20 dark:from-cyan-500/10",
    line: "bg-cyan-500/80",
    icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    soft: "bg-cyan-50 dark:bg-cyan-500/10",
  },
  emerald: {
    card: "border-emerald-100 from-emerald-50/90 dark:border-emerald-500/20 dark:from-emerald-500/10",
    line: "bg-emerald-500/80",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    soft: "bg-emerald-50 dark:bg-emerald-500/10",
  },
  amber: {
    card: "border-amber-100 from-amber-50/90 dark:border-amber-500/20 dark:from-amber-500/10",
    line: "bg-amber-500/80",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    soft: "bg-amber-50 dark:bg-amber-500/10",
  },
  rose: {
    card: "border-rose-100 from-rose-50/90 dark:border-rose-500/20 dark:from-rose-500/10",
    line: "bg-rose-500/80",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    soft: "bg-rose-50 dark:bg-rose-500/10",
  },
  violet: {
    card: "border-violet-100 from-violet-50/90 dark:border-violet-500/20 dark:from-violet-500/10",
    line: "bg-violet-500/80",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    soft: "bg-violet-50 dark:bg-violet-500/10",
  },
  slate: {
    card: "border-neutral-200 from-neutral-50 dark:border-neutral-800 dark:from-white/[0.03]",
    line: "bg-neutral-400/70",
    icon: "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-300",
    text: "text-neutral-700 dark:text-neutral-300",
    soft: "bg-neutral-50 dark:bg-white/[0.03]",
  },
};

export function toneClasses(tone: Tone) {
  return TONES[tone];
}

/** Entrance delay for the nth card in a group (staggered fade-up). */
export function stagger(index: number, step = 70): React.CSSProperties {
  return { animationDelay: `${index * step}ms` };
}

export function ToneCard({
  tone,
  index = 0,
  interactive = false,
  className,
  children,
  ...rest
}: {
  tone: Tone;
  /** Position in its group, for the staggered entrance. */
  index?: number;
  /** Lift slightly on hover (cards that are links or buttons). */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const t = TONES[tone];
  return (
    <div
      {...rest}
      style={{ ...stagger(index), ...rest.style }}
      className={cn(
        "relative overflow-hidden rounded-card border bg-gradient-to-br via-white to-white shadow-soft motion-safe:animate-fade-up dark:via-neutral-900 dark:to-neutral-900",
        t.card,
        interactive &&
          "transition duration-200 hover:-translate-y-0.5 hover:shadow-soft-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5", t.line)} />
      {children}
    </div>
  );
}

export function ToneIcon({
  tone,
  icon: Icon,
  size = "md",
}: {
  tone: Tone;
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const glyph = { sm: 16, md: 20, lg: 24 }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        box,
        TONES[tone].icon,
      )}
    >
      <Icon size={glyph} strokeWidth={1.9} />
    </span>
  );
}
