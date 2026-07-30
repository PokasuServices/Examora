"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/notifications", label: "Deliveries" },
  { href: "/notifications/broadcast", label: "Broadcast" },
  { href: "/notifications/templates", label: "Templates" },
];

/** Sub-navigation shared by the Notification admin pages (ADR-0019). */
export function NotificationsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-2 border-b border-neutral-200">
      {TABS.map((tab) => {
        const active =
          tab.href === "/notifications"
            ? pathname === "/notifications"
            : pathname?.startsWith(tab.href);
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
