"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics", label: "Dashboards" },
  { href: "/reports", label: "Reports" },
];

/** Sub-navigation shared by the Admin Analytics & Reporting pages (ADR-0020). */
export function AnalyticsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-2 border-b border-neutral-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 pb-2 text-sm font-medium ${
              active
                ? "border-b-2 border-primary-600 text-primary-700"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
