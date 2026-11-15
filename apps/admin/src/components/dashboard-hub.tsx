"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import { MENU_GROUPS, WEB_ORIGIN } from "@/config/menu";
import { Card } from "@/components/ui/card";

/**
 * The "/dashboard" content for apps/admin (rendered only for analytics:admin
 * holders — see the RequirePermission wrapper in app/dashboard/page.tsx).
 * Defers to apps/web's Executive Dashboard for platform-wide KPIs/analytics
 * (never rebuilt here) and surfaces quick navigation into apps/admin's own
 * operational sections — everything not already covered by it.
 */
export function DashboardHub() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];

  // One card per sidebar section (Assessment, Assignments, …) — the same
  // menu config the AppSidebar renders; "Platform" links out to apps/web
  // and is covered by the Executive Dashboard card above.
  const visibleGroups = MENU_GROUPS.flatMap((group) => group.items)
    .filter((item) => item.subItems && item.name !== "Platform")
    .map((item) => ({
      label: item.name,
      items: (item.subItems ?? [])
        .filter((sub) => !sub.permission || permissions.includes(sub.permission))
        .map((sub) => ({ href: sub.path, label: sub.name })),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <a
        href={`${WEB_ORIGIN}/admin`}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-4 rounded-card border border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/15 px-5 py-4 shadow-soft transition-colors hover:bg-primary-100 dark:hover:bg-primary-500/20"
      >
        <div>
          <h2 className="font-heading text-base font-semibold text-primary-900 dark:text-primary-200">
            Executive Dashboard
          </h2>
          <p className="mt-1 text-sm text-primary-700 dark:text-primary-300">
            Platform-wide KPIs, revenue, growth, and activity across Examora.
          </p>
        </div>
        <ArrowUpRight
          className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </a>

      {visibleGroups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGroups.map((group) => (
            <Card key={group.label} density="compact" className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
