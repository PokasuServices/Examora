"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { PermissionCode } from "@examora/types";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  ChevronsLeft,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileStack,
  FileText,
  FlaskConical,
  FolderTree,
  Gauge,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  Megaphone,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  Tag,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@examora/ui";

export const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionCode;
  /** Cross-origin link into apps/web's native, more complete equivalent — never rebuilt here. */
  external?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Real apps/admin route inventory, grouped by domain. Users/Content/CMS/
 * Analytics/Reports link out to apps/web's native equivalents (built later,
 * with a more complete feature set — search/filters/audit trail) rather
 * than being duplicated here. Everything else is a genuine apps/admin-only
 * page with no apps/web equivalent.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      {
        href: `${WEB_ORIGIN}/admin/users`,
        label: "Users",
        icon: Users,
        permission: "users:manage",
        external: true,
      },
      {
        href: `${WEB_ORIGIN}/admin/content`,
        label: "Content",
        icon: FolderTree,
        permission: "content:manage",
        external: true,
      },
      {
        href: `${WEB_ORIGIN}/admin/cms`,
        label: "CMS",
        icon: LayoutTemplate,
        permission: "cms:manage",
        external: true,
      },
      {
        href: `${WEB_ORIGIN}/admin/analytics`,
        label: "Analytics",
        icon: BarChart3,
        permission: "analytics:admin",
        external: true,
      },
      {
        href: `${WEB_ORIGIN}/admin/reports`,
        label: "Reports",
        icon: FileBarChart,
        permission: "analytics:admin",
        external: true,
      },
    ],
  },
  {
    label: "Assessment",
    items: [
      {
        href: "/assessment/quizzes",
        label: "Quizzes",
        icon: ListChecks,
        permission: "quiz:manage",
      },
      {
        href: "/assessment/questions",
        label: "Questions",
        icon: HelpCircle,
        permission: "question:manage",
      },
      {
        href: "/assessment/attempts",
        label: "Attempts",
        icon: ClipboardCheck,
        permission: "quiz:attempts:read",
      },
    ],
  },
  {
    label: "Assignments",
    items: [
      {
        href: "/assignments",
        label: "Assignments",
        icon: ClipboardList,
        permission: "assignment:manage",
      },
      {
        href: "/assignments/templates",
        label: "Templates",
        icon: FileStack,
        permission: "assignment:manage",
      },
      {
        href: "/assignments/submissions",
        label: "Submissions",
        icon: Inbox,
        permission: "assignment:manage",
      },
      {
        href: "/assignments/reviewer",
        label: "Reviewer queue",
        icon: CheckSquare,
        permission: "assignment:review",
      },
    ],
  },
  {
    label: "Mentoring",
    items: [
      { href: "/mentors", label: "Mentors", icon: UserCog, permission: "mentor:manage" },
      {
        href: "/mentors/assignments",
        label: "Mentor assignments",
        icon: UserPlus,
        permission: "mentor:manage",
      },
      { href: "/mentors/dashboard", label: "Workload", icon: Gauge, permission: "mentor:manage" },
      {
        href: "/mentor-dashboard",
        label: "My mentees",
        icon: UserCheck,
        permission: "mentor:workflow",
      },
      {
        href: "/mentor-analytics",
        label: "Mentor analytics",
        icon: TrendingUp,
        permission: "analytics:mentor",
      },
    ],
  },
  {
    label: "Community",
    items: [
      {
        href: "/community/forums",
        label: "Forums",
        icon: MessageSquare,
        permission: "community:manage",
      },
      {
        href: "/community/moderation",
        label: "Moderation",
        icon: ShieldAlert,
        permission: "community:moderate",
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      {
        href: "/commerce/orders",
        label: "Orders",
        icon: ShoppingBag,
        permission: "commerce:manage",
      },
      { href: "/commerce/coupons", label: "Coupons", icon: Tag, permission: "commerce:manage" },
      {
        href: "/commerce/refunds",
        label: "Refunds",
        icon: RotateCcw,
        permission: "commerce:manage",
      },
      {
        href: "/commerce/enrollments",
        label: "Enrollments",
        icon: BookOpen,
        permission: "commerce:manage",
      },
    ],
  },
  {
    label: "Notifications",
    items: [
      {
        href: "/notifications",
        label: "Deliveries",
        icon: Bell,
        permission: "notification:manage",
      },
      {
        href: "/notifications/broadcast",
        label: "Broadcast",
        icon: Megaphone,
        permission: "notification:manage",
      },
      {
        href: "/notifications/templates",
        label: "Templates",
        icon: FileText,
        permission: "notification:manage",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/progress", label: "Progress", icon: Activity, permission: "progress:read" },
      {
        href: "/feature-flags",
        label: "Feature flags",
        icon: FlaskConical,
        permission: "recommendations:admin",
      },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
    collapsed && "justify-center px-0",
    active
      ? "bg-primary-50 text-primary-700"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  );
  const content = (
    <>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      {!collapsed ? <span aria-hidden={collapsed}>{item.label}</span> : null}
      {collapsed ? <span className="sr-only">{item.label}</span> : null}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={className}
    >
      {content}
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
  const permissions = user?.permissions ?? [];

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
          {!collapsed ? (
            <span>
              Examora <span className="font-normal text-neutral-400">Admin</span>
            </span>
          ) : null}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              item={{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }}
              active={pathname === "/dashboard"}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </li>
        </ul>

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
          );
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={group.label}>
              <div className={cn("mt-4 mb-1 px-3", collapsed && "px-0 text-center")}>
                {!collapsed ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {group.label}
                  </p>
                ) : (
                  <div className="h-px bg-neutral-100" aria-hidden="true" />
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {visibleItems.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={!item.external && isActive(pathname, item.href)}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </React.Fragment>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-neutral-900/[0.06] px-3 py-4">
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

/** Persistent left rail (desktop) / full-height drawer overlay (mobile). Mirrors apps/web's Sidebar structure exactly. */
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
