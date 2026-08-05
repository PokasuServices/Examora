/** Shared across Course Details and the Quiz Experience — both format a minutes value the same way. */
export function formatDuration(minutes: number): string | null {
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Same rule already duplicated in the Dashboard's CommunityActivity and Mentor's ActivityTimelineSection — the one canonical copy for new call sites. */
export function timeAgo(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (hours < 24 * 30) return `${Math.floor(hours / 24)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface NamedAuthor {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export function authorDisplayName(author: NamedAuthor): string {
  const name = [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
  return name || author.email;
}

export function authorInitials(author: NamedAuthor): string {
  if (author.firstName || author.lastName) {
    return `${author.firstName?.[0] ?? ""}${author.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  }
  return author.email[0]?.toUpperCase() ?? "?";
}
