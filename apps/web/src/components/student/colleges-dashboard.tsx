"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, CalendarClock, Mail, Radio, Video } from "lucide-react";
import { cn } from "@examora/ui";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { stagger, ToneIcon } from "@/components/ui/tone-card";
import { useDashboardsApi } from "@/lib/dashboards-api";
import { AlertStrip, StatGrid, type DashAlert } from "./dash-ui";

const WHEN = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function startsIn(iso: string): { label: string; live: boolean; soon: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Live now", live: true, soon: true };
  const h = Math.floor(ms / 3_600_000);
  if (h < 24)
    return {
      label: h < 1 ? "Starts within the hour" : `Starts in ${h} h`,
      live: false,
      soon: true,
    };
  const d = Math.round(h / 24);
  return { label: `In ${d} ${d === 1 ? "day" : "days"}`, live: false, soon: false };
}

const ENQUIRY_STYLE: Record<string, string> = {
  NEW: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  CONTACTED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  CLOSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};
const ENQUIRY_LABEL: Record<string, string> = {
  NEW: "Sent, awaiting reply",
  CONTACTED: "College replied",
  CLOSED: "Closed",
};

/** Colleges tab overview: my shortlist, webinars I registered for, my enquiries. */
export function CollegesDashboard() {
  const api = useDashboardsApi();
  const dash = useLoad(() => api.colleges(), "colleges-dashboard");
  const d = dash.data;
  if (!d) return null;
  const soon = d.myWebinars.filter((w) => startsIn(w.startsAt).soon);

  const alerts: DashAlert[] = soon.map((w) => {
    const s = startsIn(w.startsAt);
    return {
      tone: s.live ? ("rose" as const) : ("amber" as const),
      icon: s.live ? Radio : CalendarClock,
      text: `${s.label}: ${w.title}`,
      href: w.joinUrl && s.live ? w.joinUrl : `/webinars/${w.slug}`,
      action: s.live ? "Join" : "Details",
      pulse: true,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <StatGrid
        stats={[
          {
            tone: "indigo",
            icon: Bookmark,
            label: "Shortlisted",
            value: String(d.shortlisted.length),
            hint: d.shortlisted.length
              ? "Colleges you're keeping an eye on"
              : "Tap the bookmark on a college",
            onClick: () =>
              document.getElementById("my-shortlist")?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            tone: "violet",
            icon: Video,
            label: "My webinars",
            value: String(d.myWebinars.length),
            hint: soon.length ? `${soon.length} within a day` : "Registered and upcoming",
          },
          {
            tone: "cyan",
            icon: CalendarClock,
            label: "More webinars",
            value: String(d.otherUpcomingWebinars),
            hint: "Upcoming, not registered yet",
            href: "/webinars",
          },
          {
            tone: "amber",
            icon: Mail,
            label: "Enquiries",
            value: String(d.enquiries.length),
            hint: `${d.enquiries.filter((e) => e.status === "NEW").length} awaiting a reply`,
          },
        ]}
      />
      <AlertStrip alerts={alerts} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          id="my-shortlist"
          className="scroll-mt-20 motion-safe:animate-fade-up"
          style={stagger(4)}
        >
          <div className="mb-3 flex items-center gap-3">
            <ToneIcon tone="indigo" icon={Bookmark} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              My shortlist
            </h2>
          </div>
          {d.shortlisted.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing shortlisted yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {d.shortlisted.slice(0, 6).map((c, i) => (
                <li key={c.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
                  <Link
                    href={`/colleges/${c.slug}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-indigo-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-indigo-500/10"
                  >
                    <span className="truncate font-medium text-neutral-800 dark:text-white/90">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">{c.city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="motion-safe:animate-fade-up" style={stagger(5)}>
          <div className="mb-3 flex items-center gap-3">
            <ToneIcon tone="violet" icon={Video} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              My webinars
            </h2>
          </div>
          {d.myWebinars.length === 0 ? (
            <p className="text-sm text-neutral-500">
              You haven&rsquo;t registered for any.{" "}
              <Link
                href="/webinars"
                className="font-medium text-violet-700 underline dark:text-violet-300"
              >
                See what&rsquo;s coming up
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.myWebinars.slice(0, 4).map((w, i) => {
                const s = startsIn(w.startsAt);
                return (
                  <li key={w.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
                    <Link
                      href={`/webinars/${w.slug}`}
                      className="block rounded-lg border border-neutral-200 px-3 py-2 hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800"
                    >
                      <span className="block truncate text-sm font-medium text-neutral-800 dark:text-white/90">
                        {w.title}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                        {WHEN.format(new Date(w.startsAt))}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-semibold",
                            s.live
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                              : s.soon
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                                : "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
                          )}
                        >
                          {s.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="motion-safe:animate-fade-up" style={stagger(6)}>
          <div className="mb-3 flex items-center gap-3">
            <ToneIcon tone="amber" icon={Mail} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              My enquiries
            </h2>
          </div>
          {d.enquiries.length === 0 ? (
            <p className="text-sm text-neutral-500">Ask a college a question from its page.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.enquiries.map((e, i) => (
                <li key={e.id} className="motion-safe:animate-fade-up" style={stagger(i)}>
                  <Link
                    href={`/colleges/${e.collegeSlug}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-amber-500/5"
                  >
                    <span className="truncate text-sm font-medium text-neutral-800 dark:text-white/90">
                      {e.collegeName}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        ENQUIRY_STYLE[e.status] ?? "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {ENQUIRY_LABEL[e.status] ?? e.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
