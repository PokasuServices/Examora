import type { PermissionCode } from "@examora/types";
import {
  Activity,
  Bell,
  ClipboardList,
  Globe,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  ShoppingBag,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

/**
 * Sidebar menu definition — same data model as the TMS AppSidebar's
 * `menuGroups` (group → item → optional subItems, each gated by access),
 * with Examora permission codes in place of TMS `userTypes`.
 */
export interface MenuSubItem {
  name: string;
  path: string;
  permission?: PermissionCode;
  /** Only an exact pathname match counts as active (e.g. a section root). */
  exact?: boolean;
  /** Opens in a new tab (cross-app link into apps/web). */
  external?: boolean;
}

export interface MenuItem {
  name: string;
  icon: LucideIcon;
  path?: string;
  permission?: PermissionCode;
  exact?: boolean;
  external?: boolean;
  subItems?: MenuSubItem[];
}

export interface MenuGroup {
  title: string;
  permission?: PermissionCode;
  items: MenuItem[];
}

/**
 * Real apps/admin route inventory. "Platform" links out to apps/web's
 * native, more complete equivalents (search/filters/audit trail) rather
 * than duplicating them here; every other entry is an apps/admin-only page.
 */
export const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Menu",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard", exact: true },
      {
        name: "Platform",
        icon: Globe,
        subItems: [
          {
            name: "Users",
            path: `${WEB_ORIGIN}/admin/users`,
            permission: "users:manage",
            external: true,
          },
          {
            name: "Content",
            path: `${WEB_ORIGIN}/admin/content`,
            permission: "content:manage",
            external: true,
          },
          {
            name: "CMS",
            path: `${WEB_ORIGIN}/admin/cms`,
            permission: "cms:manage",
            external: true,
          },
          {
            name: "Analytics",
            path: `${WEB_ORIGIN}/admin/analytics`,
            permission: "analytics:admin",
            external: true,
          },
          {
            name: "Reports",
            path: `${WEB_ORIGIN}/admin/reports`,
            permission: "analytics:admin",
            external: true,
          },
        ],
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        name: "Assessment",
        icon: ListChecks,
        subItems: [
          { name: "Quizzes", path: "/assessment/quizzes", permission: "quiz:manage" },
          { name: "Questions", path: "/assessment/questions", permission: "question:manage" },
          { name: "Attempts", path: "/assessment/attempts", permission: "quiz:attempts:read" },
        ],
      },
      {
        name: "Assignments",
        icon: ClipboardList,
        subItems: [
          { name: "Assignments", path: "/assignments", permission: "assignment:manage" },
          { name: "Templates", path: "/assignments/templates", permission: "assignment:manage" },
          {
            name: "Submissions",
            path: "/assignments/submissions",
            permission: "assignment:manage",
          },
          {
            name: "Reviewer queue",
            path: "/assignments/reviewer",
            permission: "assignment:review",
          },
        ],
      },
      {
        name: "Mentoring",
        icon: UserCog,
        subItems: [
          { name: "Mentors", path: "/mentors", permission: "mentor:manage" },
          { name: "Mentor assignments", path: "/mentors/assignments", permission: "mentor:manage" },
          { name: "Workload", path: "/mentors/dashboard", permission: "mentor:manage" },
          { name: "My mentees", path: "/mentor-dashboard", permission: "mentor:workflow" },
          { name: "Mentor analytics", path: "/mentor-analytics", permission: "analytics:mentor" },
        ],
      },
      {
        name: "Community",
        icon: MessageSquare,
        subItems: [
          { name: "Forums", path: "/community/forums", permission: "community:manage" },
          { name: "Moderation", path: "/community/moderation", permission: "community:moderate" },
        ],
      },
      {
        name: "Commerce",
        icon: ShoppingBag,
        subItems: [
          { name: "Orders", path: "/commerce/orders", permission: "commerce:manage" },
          { name: "Coupons", path: "/commerce/coupons", permission: "commerce:manage" },
          { name: "Refunds", path: "/commerce/refunds", permission: "commerce:manage" },
          { name: "Enrollments", path: "/commerce/enrollments", permission: "commerce:manage" },
        ],
      },
      {
        name: "Notifications",
        icon: Bell,
        subItems: [
          { name: "Deliveries", path: "/notifications", permission: "notification:manage" },
          {
            name: "Broadcast",
            path: "/notifications/broadcast",
            permission: "notification:manage",
          },
          {
            name: "Templates",
            path: "/notifications/templates",
            permission: "notification:manage",
          },
        ],
      },
      {
        name: "Insights",
        icon: Activity,
        subItems: [
          { name: "Progress", path: "/progress", permission: "progress:read" },
          { name: "Feature flags", path: "/feature-flags", permission: "recommendations:admin" },
        ],
      },
    ],
  },
];
