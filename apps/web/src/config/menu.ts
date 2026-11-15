import type { PermissionCode } from "@examora/types";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

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
  /** Opens in a new tab (cross-app link). */
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

// Ordered by frequency of use — Dashboard/My Courses are daily habits,
// Analytics/Recommendations are consulted, not lived in.
export const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Menu",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { name: "My Courses", icon: BookOpen, path: "/courses" },
      { name: "Quizzes", icon: ListChecks, path: "/quizzes" },
      { name: "Assignments", icon: ClipboardList, path: "/assignments" },
      { name: "Community", icon: MessageSquare, path: "/community" },
      { name: "My Purchases", icon: ShoppingBag, path: "/orders" },
      { name: "Recommendations", icon: Sparkles, path: "/recommendations" },
      { name: "Analytics", icon: BarChart3, path: "/analytics" },
    ],
  },
  {
    // mentor:workflow — MENTOR + ADMINISTRATOR, the same permission the
    // backend requires on every mentor-workflow endpoint.
    title: "Mentoring",
    permission: "mentor:workflow",
    items: [
      {
        name: "Mentoring",
        icon: Users,
        subItems: [
          { name: "Mentor Dashboard", path: "/mentor/dashboard" },
          { name: "My Students", path: "/mentor/students" },
          { name: "Mentor Analytics", path: "/mentor/analytics" },
        ],
      },
    ],
  },
  {
    // analytics:admin — ADMINISTRATOR only.
    title: "Administration",
    permission: "analytics:admin",
    items: [
      {
        name: "Manage Platform",
        icon: ShieldCheck,
        subItems: [
          { name: "Admin Dashboard", path: "/admin", exact: true },
          { name: "User Management", path: "/admin/users" },
          { name: "Content", path: "/admin/content" },
          { name: "CMS", path: "/admin/cms" },
          { name: "Admin Analytics", path: "/admin/analytics" },
          { name: "Reports", path: "/admin/reports" },
          { name: "Broadcasts", path: "/notifications/broadcasts" },
        ],
      },
    ],
  },
  {
    title: "Others",
    items: [
      { name: "Settings", icon: Settings, path: "/profile" },
      { name: "Help", icon: HelpCircle, path: "/faq" },
    ],
  },
];
