"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import { NAV_GROUPS, WEB_ORIGIN } from "@/components/shell/sidebar";
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

  const visibleGroups = NAV_GROUPS.filter((group) => group.label !== "Platform")
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || permissions.includes(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <a
        href={`${WEB_ORIGIN}/admin`}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-4 rounded-card border border-primary-200 bg-primary-50 px-5 py-4 shadow-soft transition-colors hover:bg-primary-100"
      >
        <div>
          <h2 className="font-heading text-base font-semibold text-primary-900">
            Executive Dashboard
          </h2>
          <p className="mt-1 text-sm text-primary-700">
            Platform-wide KPIs, revenue, growth, and activity across Examora.
          </p>
        </div>
        <ArrowUpRight
          className="h-5 w-5 shrink-0 text-primary-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </a>

      {visibleGroups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGroups.map((group) => (
            <Card key={group.label} density="compact" className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-primary-600 hover:underline"
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
