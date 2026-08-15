"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import {
  BarChart3,
  BookOpen,
  ChevronsLeft,
  ClipboardList,
  FileBarChart,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  MessageSquare,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@examora/ui";

interface NavItemConfig {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Ordered by frequency of use, not alphabetically — Dashboard/My Courses are
// daily habits, Analytics/Recommendations are consulted, not lived in.
const NAV_ITEMS: NavItemConfig[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", icon: BookOpen },
  { href: "/quizzes", label: "Quizzes", icon: ListChecks },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/community", label: "Community", icon: MessageSquare },
  { href: "/orders", label: "My Purchases", icon: ShoppingBag },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const FOOTER_ITEMS: NavItemConfig[] = [
  { href: "/profile", label: "Settings", icon: Settings },
  { href: "/faq", label: "Help", icon: HelpCircle },
];

// Shown only to accounts holding mentor:workflow (MENTOR + ADMINISTRATOR —
// same permission the backend itself requires on every mentor-workflow
// endpoint). Invisible to plain students and REVIEWER-only accounts.
const MENTOR_NAV_ITEMS: NavItemConfig[] = [
  { href: "/mentor/dashboard", label: "Mentor Dashboard", icon: LayoutDashboard },
  { href: "/mentor/students", label: "My Students", icon: Users },
  { href: "/mentor/analytics", label: "Mentor Analytics", icon: BarChart3 },
];

// Shown only to accounts holding analytics:admin (ADMINISTRATOR-only, per
// packages/types/src/permission.ts) — the cross-platform dashboards and
// Report Builder, both of which already exist as their own workspace in
// apps/admin; this is the same read data in this app's design system.
const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/content", label: "Content", icon: FolderTree },
  { href: "/admin/cms", label: "CMS", icon: LayoutTemplate },
  { href: "/admin/analytics", label: "Admin Analytics", icon: BarChart3 },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
];

// "/admin" itself would otherwise startsWith-match every other /admin/* item
// too — same route-prefix collision fixed for Settings/Orders — so it needs
// an exact match instead.
function isAdminNavItemActive(pathname: string | null, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : (pathname?.startsWith(href) ?? false);
}

function NavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItemConfig;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary-50 text-primary-700"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      {!collapsed ? <span aria-hidden={collapsed}>{item.label}</span> : null}
      {collapsed ? <span className="sr-only">{item.label}</span> : null}
    </Link>
  );
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isMentor = user?.permissions.includes("mentor:workflow") ?? false;
  const isAdmin = user?.permissions.includes("analytics:admin") ?? false;

  return (
    <nav aria-label="Main" className="flex h-full flex-col bg-white">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-neutral-900/[0.06] px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-heading text-lg font-bold text-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-sm text-white">
            E
          </span>
          {!collapsed ? <span>Examora</span> : null}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavItem
                item={item}
                active={pathname?.startsWith(item.href) ?? false}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        {isMentor ? (
          <>
            <div className={cn("mt-4 mb-1 px-3", collapsed && "px-0 text-center")}>
              {!collapsed ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Mentor
                </p>
              ) : (
                <div className="h-px bg-neutral-100" aria-hidden="true" />
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {MENTOR_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavItem
                    item={item}
                    active={pathname?.startsWith(item.href) ?? false}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {isAdmin ? (
          <>
            <div className={cn("mt-4 mb-1 px-3", collapsed && "px-0 text-center")}>
              {!collapsed ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Admin
                </p>
              ) : (
                <div className="h-px bg-neutral-100" aria-hidden="true" />
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <NavItem
                    item={item}
                    active={isAdminNavItemActive(pathname, item.href)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-neutral-900/[0.06] px-3 py-4">
        <ul className="flex flex-col gap-1">
          {FOOTER_ITEMS.map((item) => (
            <li key={item.href}>
              <NavItem
                item={item}
                active={pathname?.startsWith(item.href) ?? false}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            className={cn(
              "mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              collapsed && "justify-center px-0",
            )}
          >
            <ChevronsLeft
              size={20}
              strokeWidth={1.75}
              className={cn("shrink-0 transition-transform", collapsed && "rotate-180")}
              aria-hidden="true"
            />
            {!collapsed ? <span>Collapse</span> : null}
            <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}

/** Persistent left rail (desktop) / full-height drawer overlay (mobile). */
export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      {/* Desktop: persistent rail */}
      <div
        className={cn(
          "hidden shrink-0 border-r border-neutral-900/[0.06] transition-[width] duration-150 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div
          className="fixed inset-y-0 z-20 hidden lg:block"
          style={{ width: collapsed ? 72 : 256 }}
        >
          <SidebarContent collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
        </div>
      </div>

      {/* Mobile: drawer overlay */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-neutral-900/40"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-soft-hover">
            <div className="flex h-16 items-center justify-end border-b border-neutral-900/[0.06] bg-white px-4">
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)]">
              <SidebarContent collapsed={false} onNavigate={onMobileClose} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
