import {
  Award,
  Bell,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Receipt,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ChipTone } from "@/components/ui/chip";

/**
 * Icon/tone per real `category` string observed across every notificationsService.enqueue()
 * call site in the API (account_security, learning, assignments, mentoring,
 * commerce, community, analytics, platform) — category is a free-text column,
 * not a Prisma enum, so unknown values fall back to a generic bell rather than
 * being invented or hidden.
 */
const CATEGORY_META: Record<string, { icon: LucideIcon; tone: ChipTone; label: string }> = {
  account_security: { icon: ShieldAlert, tone: "danger", label: "Account & security" },
  learning: { icon: BookOpen, tone: "primary", label: "Learning" },
  assignments: { icon: ClipboardList, tone: "accent", label: "Assignments" },
  mentoring: { icon: Users, tone: "success", label: "Mentoring" },
  commerce: { icon: Receipt, tone: "warning", label: "Purchases" },
  community: { icon: MessageSquare, tone: "primary", label: "Community" },
  analytics: { icon: Award, tone: "neutral", label: "Reports" },
  platform: { icon: Bell, tone: "neutral", label: "Announcements" },
};

export function categoryMeta(category: string): {
  icon: LucideIcon;
  tone: ChipTone;
  label: string;
} {
  return (
    CATEGORY_META[category] ?? {
      icon: Bell,
      tone: "neutral",
      label: category.charAt(0).toUpperCase() + category.slice(1),
    }
  );
}

/**
 * Deep link derived only from `data` shapes actually enqueued somewhere in
 * the API (grep-verified against every notificationsService.enqueue() call
 * site) — never a guess. Returns null when the event type carries no
 * navigable payload (e.g. auth.* events only carry a one-time token).
 */
export function resolveDeepLink(
  eventType: string,
  data: Record<string, unknown> | null,
): string | null {
  if (!data) return null;
  const str = (key: string): string | null =>
    typeof data[key] === "string" ? (data[key] as string) : null;

  switch (eventType) {
    case "enrollment.granted": {
      const courseId = str("courseId");
      return courseId ? `/courses/${courseId}` : null;
    }
    case "assignment.due_reminder": {
      const assignmentId = str("assignmentId");
      return assignmentId ? `/assignments/${assignmentId}` : null;
    }
    case "assignment.review_published": {
      const submissionId = str("submissionId");
      return submissionId ? `/assignments/submission/${submissionId}` : null;
    }
    case "commerce.payment_success":
    case "commerce.payment_failed":
    case "commerce.refund_processed": {
      const orderId = str("orderId");
      return orderId ? `/orders/${orderId}` : null;
    }
    case "community.reply_received":
    case "community.answer_accepted":
    case "community.moderation_action": {
      const threadId = str("threadId");
      return threadId ? `/community/threads/${threadId}` : null;
    }
    case "mentor.assigned": {
      // Only meaningful for the mentor recipient (data.studentId) — a
      // student recipient only gets data.mentorId, which has no student-
      // facing profile page to link to, so this intentionally resolves to
      // null for that side.
      const studentId = str("studentId");
      return studentId ? `/mentor/students/${studentId}` : null;
    }
    case "analytics.scheduled_report_ready":
      // No per-report detail route exists — same "closest real destination"
      // fallback the Header's global search already uses for its own gap.
      return "/analytics";
    default:
      return null;
  }
}
