import type { PersonRef } from "@examora/types";

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export type NamedUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export const USER_NAME_SELECT = { id: true, email: true, firstName: true, lastName: true } as const;

export function personName(u: Pick<NamedUser, "email" | "firstName" | "lastName">): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
}

export function person(u: NamedUser): PersonRef {
  return { id: u.id, name: personName(u), email: u.email };
}

/** Today in India as a UTC-midnight date. */
export function todayIndia(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Minutes since midnight in India, e.g. 18:30 → 1110. */
export function minutesNowIndia(now = new Date()): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const dow = d.getUTCDay();
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y!, m! - 1, 1));
  const to = new Date(Date.UTC(y!, m!, 0));
  return { from, to };
}

export function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

export function hoursSince(d: Date | null | undefined, now = new Date()): number | null {
  return d ? Math.max(0, Math.round((now.getTime() - d.getTime()) / 3_600_000)) : null;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
