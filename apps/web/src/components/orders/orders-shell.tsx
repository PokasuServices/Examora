"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  History,
  LayoutDashboard,
  Receipt,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@examora/ui";

interface OrdersNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ORDERS_NAV: OrdersNavItem[] = [
  { href: "/orders", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders/history", label: "Order History", icon: History },
  { href: "/orders/invoices", label: "Invoices", icon: Receipt },
  { href: "/orders/refunds", label: "Refunds", icon: RotateCcw },
  { href: "/orders/enrollments", label: "Enrollments", icon: GraduationCap },
];

export function OrdersShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="flex flex-col gap-8 lg:flex-row lg:gap-10">
      <nav aria-label="Orders" className="lg:w-52 lg:shrink-0">
        <h1 className="px-1 text-xl font-semibold text-neutral-800 dark:text-white/90">
          Orders &amp; Billing
        </h1>
        <ul className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-6 lg:flex-col lg:overflow-visible lg:pb-0">
          {ORDERS_NAV.map((item) => {
            const active =
              item.href === "/orders" ? pathname === "/orders" : pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0 lg:shrink">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    active
                      ? "bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white/90",
                  )}
                >
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
