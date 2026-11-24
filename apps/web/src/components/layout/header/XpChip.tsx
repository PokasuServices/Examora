"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useXp } from "@/context/XpContext";

/** The student's XP total in the header; opens Rewards. Renders nothing outside the student shell. */
export function XpChip() {
  const { xp } = useXp();
  if (!xp) return null;
  return (
    <Link
      href="/rewards"
      aria-label={`${xp.totalXp} XP. Open rewards`}
      className="flex h-10 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <Zap size={16} aria-hidden="true" className="fill-warning-500 text-warning-500" />
      {xp.totalXp.toLocaleString("en-IN")} XP
    </Link>
  );
}
