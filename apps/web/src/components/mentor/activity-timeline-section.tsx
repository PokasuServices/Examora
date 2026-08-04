import {
  Activity,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  ListTodo,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ActivityTimelineEventType, ActivityTimelineItem } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";

const EVENT_ICON: Record<ActivityTimelineEventType, LucideIcon> = {
  LESSON_COMPLETED: CheckCircle2,
  QUIZ_ATTEMPT: HelpCircle,
  ASSIGNMENT_SUBMITTED: ClipboardList,
  MENTOR_NOTE: FileText,
  MENTOR_TASK: ListTodo,
  MENTOR_FEEDBACK: MessageSquare,
  MENTOR_MEETING: Users,
};

function timeAgo(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Real, server-composed timeline (Student360Service.buildActivityTimeline) — merges learning/quiz/assignment/mentoring events, capped at 50. */
export function ActivityTimelineSection({ items }: { items: ActivityTimelineItem[] }) {
  return (
    <section aria-labelledby="activity-timeline-heading">
      <h2
        id="activity-timeline-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Recent Activity
      </h2>
      <Card className="mt-3">
        {items.length === 0 ? (
          <EmptyState icon={Activity} heading="No activity yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {items.slice(0, 15).map((item, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <IconBadge icon={EVENT_ICON[item.type]} tone="primary" size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-neutral-800">{item.title}</p>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {timeAgo(item.occurredAt)}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{item.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
