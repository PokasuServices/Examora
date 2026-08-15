"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderTree, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@examora/ui";

interface ContentNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const CONTENT_NAV: ContentNavItem[] = [
  { href: "/admin/content", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/content/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/content/courses", label: "Courses", icon: BookOpen },
];

export function ContentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10 lg:px-8">
      <nav aria-label="Content management" className="lg:w-52 lg:shrink-0">
        <h1 className="px-1 font-heading text-2xl font-bold text-neutral-900">Content</h1>
        <ul className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-6 lg:flex-col lg:overflow-visible lg:pb-0">
          {CONTENT_NAV.map((item) => {
            const active =
              item.href === "/admin/content"
                ? pathname === "/admin/content"
                : pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0 lg:shrink">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
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
