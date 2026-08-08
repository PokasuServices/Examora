import type { RoleName } from "@examora/types";

const ROLE_LABELS: Record<RoleName, string> = {
  STUDENT: "Student",
  MENTOR: "Mentor",
  REVIEWER: "Reviewer",
  ADMINISTRATOR: "Administrator",
  GUARDIAN: "Guardian",
};

export function roleLabel(role: RoleName): string {
  return ROLE_LABELS[role];
}

/** Deterministic OS/browser read of a real User-Agent string — never a device guess beyond what the string states. */
export function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  let os = "Unknown OS";
  if (/windows/i.test(userAgent)) os = "Windows";
  else if (/iphone|ipad/i.test(userAgent)) os = "iOS";
  else if (/mac os/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(userAgent)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/chrome\//i.test(userAgent)) browser = "Chrome";
  else if (/firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/safari\//i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";

  return `${os} · ${browser}`;
}

export interface ProfileCompletionField {
  label: string;
  complete: boolean;
}

/** Every field counted here is a real, already-fetched UserProfile field — no fabricated checklist items. */
export function profileCompletion(fields: ProfileCompletionField[]): {
  percent: number;
  completed: number;
  total: number;
} {
  const completed = fields.filter((f) => f.complete).length;
  const total = fields.length;
  return { percent: total === 0 ? 0 : Math.round((completed / total) * 100), completed, total };
}
