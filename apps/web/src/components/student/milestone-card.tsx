import { Award, Lock } from "lucide-react";
import { cn } from "@examora/ui";

/** Examora's own milestone badges: a ringed medal per tier. */
const TIERS: Record<number, { title: string; ring: string; fill: string }> = {
  5: { title: "First points", ring: "ring-sky-400", fill: "bg-sky-500" },
  10: { title: "Getting started", ring: "ring-violet-400", fill: "bg-violet-500" },
  50: { title: "Great effort", ring: "ring-orange-400", fill: "bg-orange-500" },
  100: { title: "Century", ring: "ring-emerald-400", fill: "bg-emerald-500" },
  500: { title: "Rising star", ring: "ring-rose-400", fill: "bg-rose-500" },
  1000: { title: "Thousand club", ring: "ring-indigo-400", fill: "bg-indigo-600" },
  2500: { title: "Dedicated", ring: "ring-teal-400", fill: "bg-teal-500" },
  5000: { title: "Expert", ring: "ring-fuchsia-400", fill: "bg-fuchsia-600" },
  12000: { title: "Legend", ring: "ring-amber-400", fill: "bg-amber-500" },
};

export function MilestoneCard({ xp, reached }: { xp: number; reached: boolean }) {
  const tier = TIERS[xp] ?? {
    title: "Milestone",
    ring: "ring-primary-400",
    fill: "bg-primary-600",
  };
  const label = xp >= 1000 ? `${xp / 1000}k` : String(xp);
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <span
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full ring-4 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900",
          reached
            ? [tier.fill, tier.ring, "text-white"]
            : "bg-neutral-100 text-neutral-400 ring-neutral-200 dark:bg-white/5 dark:ring-neutral-700",
        )}
      >
        {reached ? (
          <span className="flex flex-col items-center leading-none">
            <Award size={20} aria-hidden="true" />
            <span className="mt-1 text-sm font-bold">{label}</span>
          </span>
        ) : (
          <Lock size={22} aria-hidden="true" />
        )}
      </span>
      <span className="text-sm font-medium text-neutral-800 dark:text-white/90">{tier.title}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {xp.toLocaleString("en-IN")} XP{reached ? "" : " · locked"}
      </span>
    </li>
  );
}
