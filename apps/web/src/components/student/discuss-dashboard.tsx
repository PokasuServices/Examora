"use client";

import * as React from "react";
import Link from "next/link";
import {
  Flame,
  Heart,
  HelpCircle,
  MessageCircle,
  MessageSquareReply,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@examora/ui";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { stagger, ToneIcon } from "@/components/ui/tone-card";
import { useDashboardsApi } from "@/lib/dashboards-api";
import { AlertStrip, StatGrid, useMarkSeenOnce, type DashAlert } from "./dash-ui";

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Discuss tab overview: replies to my posts, likes, my doubts, popular this week. */
export function DiscussDashboard() {
  const api = useDashboardsApi();
  const dash = useLoad(() => api.discuss(), "discuss-dashboard");
  useMarkSeenOnce(Boolean(dash.data), () => api.markSeen("discuss"));
  const d = dash.data;
  if (!d) return null;
  const c = d.counts;

  const alerts: DashAlert[] = [
    ...(c.newReplies > 0 && d.latestReplies[0]
      ? [
          {
            tone: "indigo" as const,
            icon: MessageSquareReply,
            text: `${c.newReplies} new ${c.newReplies === 1 ? "reply" : "replies"} on your discussions`,
            href: `/community/threads/${d.latestReplies[0].threadId}`,
            action: "Read",
            pulse: true,
          },
        ]
      : []),
    ...(c.newDoubtReplies > 0
      ? [
          {
            tone: "violet" as const,
            icon: HelpCircle,
            text: `${c.newDoubtReplies} new ${c.newDoubtReplies === 1 ? "reply" : "replies"} to your question doubts. Check your bell`,
            href: "/notifications",
            action: "Open",
            pulse: true,
          },
        ]
      : []),
    ...(c.unanswered > 0
      ? [
          {
            tone: "amber" as const,
            icon: MessageCircle,
            text: `${c.unanswered} of your discussions ${c.unanswered === 1 ? "has" : "have"} no replies yet`,
            href: "/community/me",
            action: "View",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <StatGrid
        stats={[
          {
            tone: "indigo",
            icon: MessagesSquare,
            label: "My discussions",
            value: String(c.myThreads),
            hint: `${c.unanswered} waiting for replies`,
            href: "/community/me",
          },
          {
            tone: "cyan",
            icon: MessageSquareReply,
            label: "New replies",
            value: String(c.newReplies),
            hint: d.lastSeenAt ? "Since your last visit" : "This week",
          },
          {
            tone: "rose",
            icon: Heart,
            label: "Likes received",
            value: String(c.likesReceived),
            hint: "On your posts and doubts",
          },
          {
            tone: "violet",
            icon: HelpCircle,
            label: "My question doubts",
            value: String(c.myDoubts),
            hint: `${c.newDoubtReplies} new replies`,
          },
        ]}
      />
      <AlertStrip alerts={alerts} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="motion-safe:animate-fade-up" style={stagger(4)}>
          <div className="mb-3 flex items-center gap-3">
            <ToneIcon tone="indigo" icon={MessageSquareReply} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              Replies to you
            </h2>
          </div>
          {d.latestReplies.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No replies yet. Start a discussion and classmates will chip in.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.latestReplies.map((r, i) => (
                <li
                  key={`${r.threadId}-${r.at}`}
                  className="motion-safe:animate-fade-up"
                  style={stagger(i)}
                >
                  <Link
                    href={`/community/threads/${r.threadId}`}
                    className={cn(
                      "block rounded-lg border px-3 py-2 transition hover:shadow-soft-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                      r.isNew
                        ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                        : "border-neutral-200 dark:border-neutral-800",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                      <span>
                        <strong className="text-neutral-800 dark:text-white/90">
                          {r.authorName}
                        </strong>{" "}
                        on &ldquo;{r.threadTitle}&rdquo;
                      </span>
                      <span className="shrink-0">
                        {r.isNew ? (
                          <span className="mr-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            New
                          </span>
                        ) : null}
                        {ago(r.at)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-neutral-700 dark:text-neutral-300">
                      {r.excerpt}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="motion-safe:animate-fade-up" style={stagger(5)}>
          <div className="mb-3 flex items-center gap-3">
            <ToneIcon tone="amber" icon={Flame} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              Popular this week
            </h2>
          </div>
          {d.popularThisWeek.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Quiet week so far. Be the one to start a discussion!
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {d.popularThisWeek.map((p, i) => (
                <li key={p.threadId} className="motion-safe:animate-fade-up" style={stagger(i)}>
                  <Link
                    href={`/community/threads/${p.threadId}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-amber-500/5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-white/90">
                      {p.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                      {p.replies} replies · {p.likes} likes
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
