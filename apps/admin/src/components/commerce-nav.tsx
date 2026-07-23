"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/commerce/orders", label: "Orders" },
  { href: "/commerce/refunds", label: "Refunds" },
  { href: "/commerce/coupons", label: "Coupons" },
  { href: "/commerce/enrollments", label: "Enrollments" },
];

/** Sub-navigation shared by the Commerce admin pages (ADR-0018). */
export function CommerceNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-2 border-b border-neutral-200">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 pb-2 text-sm font-medium ${
            pathname?.startsWith(tab.href)
              ? "border-b-2 border-primary-600 text-primary-700"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
