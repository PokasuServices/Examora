import {
  BookOpen,
  Brain,
  ClipboardList,
  Eye,
  Globe,
  Languages,
  Lightbulb,
  Pencil,
  Rocket,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@examora/ui";
import { Chip } from "@/components/ui/chip";

/** Icon names an admin can set on a subject (Subject.icon). Unknown names fall back to a book. */
const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  lightbulb: Lightbulb,
  eye: Eye,
  globe: Globe,
  sigma: Sigma,
  languages: Languages,
  pencil: Pencil,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
};

/** Soft tint per colour family (full class strings so Tailwind keeps them). */
const TINTS: Record<string, string> = {
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  primary: "bg-primary-500/10 text-primary-600 dark:text-primary-400",
};

/** Rounded-square, soft-tinted subject icon (Examora's IconBadge style). */
export function SubjectIcon({
  icon,
  color,
  className,
}: {
  icon: string | null;
  color: string | null;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || BookOpen;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        TINTS[color ?? "primary"] ?? TINTS.primary,
        className,
      )}
    >
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

export function KindChip({ kind }: { kind: "SUBJECT" | "ESSENTIALS" }) {
  return (
    <Chip tone={kind === "ESSENTIALS" ? "primary" : "neutral"}>
      {kind === "ESSENTIALS" ? "Essentials" : "Subject"}
    </Chip>
  );
}

/** Not started / In progress / Completed, from a 0–100 progress figure. */
export function ProgressStatusChip({ percent }: { percent: number }) {
  if (percent >= 100) return <Chip tone="success">Completed</Chip>;
  if (percent > 0) return <Chip tone="primary">In progress</Chip>;
  return <Chip tone="neutral">Not started</Chip>;
}
