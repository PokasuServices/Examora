export type DashboardScope = "today" | "week" | "month";

export const SCOPE_WINDOW_MS: Record<DashboardScope, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};
