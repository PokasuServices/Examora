"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@examora/ui";
import { ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";

export interface DashStat {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

/** A row of colour-coded stat cards (2 per row on phones, 4 on wide screens). */
export function StatGrid({ stats }: { stats: DashStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s, i) => {
        const body = (
          <>
            <ToneIcon tone={s.tone} icon={s.icon} />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-xs font-medium uppercase tracking-wide",
                  toneClasses(s.tone).text,
                )}
              >
                {s.label}
              </span>
              <span className="block text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {s.value}
              </span>
              {s.hint ? (
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {s.hint}
                </span>
              ) : null}
            </span>
          </>
        );
        const cls =
          "flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
        const clickable = Boolean(s.href || s.onClick);
        return (
          <ToneCard key={s.label} tone={s.tone} index={i} interactive={clickable} className="p-0">
            {s.href ? (
              <Link href={s.href} className={cls}>
                {body}
              </Link>
            ) : s.onClick ? (
              <button type="button" onClick={s.onClick} className={cls}>
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </ToneCard>
        );
      })}
    </div>
  );
}

export interface DashAlert {
  tone: Tone;
  icon: LucideIcon;
  text: React.ReactNode;
  href?: string;
  onClick?: () => void;
  action?: string;
  /** A soft pulse for things that just happened. */
  pulse?: boolean;
}

/** Clickable alert cards; shows `allClear` when there are none. */
export function AlertStrip({ alerts, allClear }: { alerts: DashAlert[]; allClear?: string }) {
  if (alerts.length === 0) {
    return allClear ? (
      <ToneCard tone="emerald" className="px-4 py-3">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{allClear}</p>
      </ToneCard>
    ) : null;
  }
  return (
    <section aria-label="Alerts" className="grid gap-3 md:grid-cols-2">
      {alerts.map((a, i) => {
        const inner = (
          <>
            <span className="relative flex">
              <ToneIcon tone={a.tone} icon={a.icon} size="sm" />
              {a.pulse ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full motion-safe:animate-ping",
                    toneClasses(a.tone).line,
                  )}
                />
              ) : null}
            </span>
            <span className={cn("flex-1 text-sm font-medium", toneClasses(a.tone).text)}>
              {a.text}
            </span>
            {a.href || a.onClick ? (
              <span className="shrink-0 text-xs font-medium text-neutral-500">
                {a.action ?? "Open"} <ArrowRight size={12} aria-hidden="true" className="inline" />
              </span>
            ) : null}
          </>
        );
        const cls =
          "flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
        return (
          <ToneCard
            key={i}
            tone={a.tone}
            index={i}
            interactive={Boolean(a.href || a.onClick)}
            className="p-0"
          >
            {a.href ? (
              <Link href={a.href} className={cls}>
                {inner}
              </Link>
            ) : a.onClick ? (
              <button type="button" onClick={a.onClick} className={cls}>
                {inner}
              </button>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </ToneCard>
        );
      })}
    </section>
  );
}

/** Marks a tab as seen once its data has been shown. */
export function useMarkSeenOnce(ready: boolean, mark: () => Promise<unknown>) {
  const done = React.useRef(false);
  const markRef = React.useRef(mark);
  markRef.current = mark;
  React.useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    void markRef.current().catch(() => undefined);
  }, [ready]);
}
