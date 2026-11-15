"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import { BreadcrumbTrail, type BreadcrumbCrumb } from "@/components/common/PageBreadcrumb";
import { MENU_GROUPS } from "@/config/menu";

/**
 * Derives the breadcrumb trail from the sidebar menu — the same source
 * the AppSidebar renders — so every page gets "Home › Section › Page"
 * with no per-page wiring. On a detail route (deeper than the matched
 * menu entry) the list page is included as a link.
 */
function useMenuTrail(title: string): BreadcrumbCrumb[] {
  const pathname = usePathname() ?? "";
  let best: { section: string; name: string; path: string } | null = null;
  for (const group of MENU_GROUPS) {
    for (const item of group.items) {
      for (const sub of item.subItems ?? []) {
        if (sub.external) continue;
        if (
          (pathname === sub.path || pathname.startsWith(`${sub.path}/`)) &&
          (!best || sub.path.length > best.path.length)
        ) {
          best = { section: item.name, name: sub.name, path: sub.path };
        }
      }
    }
  }
  if (!best) return [];
  const trail: BreadcrumbCrumb[] = [];
  if (best.section !== best.name) trail.push({ label: best.section });
  if (pathname !== best.path || best.name !== title)
    trail.push({ label: best.name, href: best.path });
  return trail;
}

/**
 * Page header in the TMS PageBreadcrumb layout: title left, breadcrumb
 * trail right; optional subtitle and actions on the row beneath.
 * `trail` overrides the menu-derived breadcrumb when given.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  trail,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  trail?: BreadcrumbCrumb[];
}) {
  const derivedTrail = useMenuTrail(title);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">{title}</h1>
        <BreadcrumbTrail pageTitle={title} trail={trail ?? derivedTrail} />
      </div>
      {subtitle || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {subtitle ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          ) : (
            <span />
          )}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
