/**
 * No "risk"/"flag" field exists anywhere on a student (verified against the
 * full schema) — this buckets the one real signal that does exist
 * (lastActiveAt from MentorStudentProgressEntry), using the exact same
 * 7-day / 14-day thresholds the backend's own MentorEngagementSummary
 * (studentsActiveLast7Days / studentsInactive14Days) already establishes as
 * the platform's definition of "needs attention" — not a new invented rule.
 */
export type ActivityBucket = "active" | "check-in" | "at-risk" | "never-started";

export function activityBucket(lastActiveAt: string | null): ActivityBucket {
  if (!lastActiveAt) return "never-started";
  const days = (Date.now() - new Date(lastActiveAt).getTime()) / 86_400_000;
  if (days < 7) return "active";
  if (days < 14) return "check-in";
  return "at-risk";
}

export const ACTIVITY_BUCKET_LABEL: Record<ActivityBucket, string> = {
  active: "Active",
  "check-in": "Check in soon",
  "at-risk": "Needs attention",
  "never-started": "Never started",
};
