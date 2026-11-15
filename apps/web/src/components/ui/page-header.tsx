"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { MENU_GROUPS } from "@/config/menu";

export interface BreadcrumbCrumb {
  label: string;
  /** Omit for a non-navigable section label (e.g. a sidebar group). */
  href?: string;
}

/** Flattens string/number children to text (titles are often `{course.title}`). */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/**
 * Breadcrumb trail derived from the sidebar menu — the same source the
 * AppSidebar renders — so pages get "Home › Section › Page" with no
 * per-page wiring. On a detail route (deeper than the matched menu
 * entry) the list page is included as a link.
 */
function useMenuTrail(title: string): BreadcrumbCrumb[] {
  const pathname = usePathname() ?? "";
  const hit = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  let best: { section?: string; name: string; path: string } | null = null;
  for (const group of MENU_GROUPS) {
    for (const item of group.items) {
      const candidates = item.subItems
        ? item.subItems.map((sub) => ({ section: item.name, name: sub.name, path: sub.path }))
        : item.path
          ? [{ name: item.name, path: item.path }]
          : [];
      for (const c of candidates) {
        if (hit(c.path) && (!best || c.path.length > best.path.length)) best = c;
      }
    }
  }
  if (!best || best.path === "/dashboard") return [];
  const trail: BreadcrumbCrumb[] = [];
  if (best.section && best.section !== best.name) trail.push({ label: best.section });
  if (pathname !== best.path || best.name !== title)
    trail.push({ label: best.name, href: best.path });
  return trail;
}

/** TMS `common/PageBreadcrumb.vue` trail: "Home › … › Page". */
export function BreadcrumbTrail({
  pageTitle,
  trail = [],
  homeHref = "/dashboard",
}: {
  pageTitle: string;
  trail?: BreadcrumbCrumb[];
  homeHref?: string;
}) {
  const crumbs: BreadcrumbCrumb[] = [{ label: "Home", href: homeHref }, ...trail];
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb) => (
          <li
            key={`${crumb.label}-${crumb.href ?? ""}`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-neutral-700">
                {crumb.label}
              </Link>
            ) : (
              <span>{crumb.label}</span>
            )}
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </li>
        ))}
        {pageTitle ? (
          <li
            className="max-w-[16rem] truncate text-sm text-neutral-800 dark:text-white/90"
            aria-current="page"
          >
            {pageTitle}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

/**
 * Drop-in page title in the TMS PageBreadcrumb layout: the `<h1>` on the
 * left, the menu-derived breadcrumb trail on the right. Replaces a bare
 * `<h1>` inside an existing header block, so any subtitle that follows
 * stays exactly where it was.
 */
export function PageTitle({
  children,
  trail,
  className,
}: {
  children: React.ReactNode;
  trail?: BreadcrumbCrumb[];
  className?: string;
}) {
  const title = textOf(children);
  const derivedTrail = useMenuTrail(title);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}>
      <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">{children}</h1>
      <BreadcrumbTrail pageTitle={title} trail={trail ?? derivedTrail} />
    </div>
  );
}

/**
 * Full page header (TMS PageBreadcrumb layout): title + breadcrumb on the
 * first row, optional subtitle and actions on the row beneath.
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
  return (
    <div className="flex flex-col gap-3">
      <PageTitle trail={trail}>{title}</PageTitle>
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
