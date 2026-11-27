import type { PermissionCode } from "@examora/types";
import {
  Activity,
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Globe,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Sun,
  CalendarCheck,
  CalendarDays,
  FileText,
  HelpCircle,
  Inbox,
  Megaphone,
  Sparkles,
  UserRound,
  Users,
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
  /** Hidden from anyone who holds this permission (e.g. mentor-only screens). */
  hideWith?: PermissionCode;
}

export interface MenuItem {
  name: string;
  icon: LucideIcon;
  path?: string;
  permission?: PermissionCode;
  exact?: boolean;
  external?: boolean;
  subItems?: MenuSubItem[];
  hideWith?: PermissionCode;
}

export interface MenuGroup {
  title: string;
  permission?: PermissionCode;
  hideWith?: PermissionCode;
  items: MenuItem[];
}

/**
 * Real apps/admin route inventory. "Platform" links out to apps/web's
 * native, more complete equivalents (search/filters/audit trail) rather
 * than duplicating them here; every other entry is an apps/admin-only page.
 */
export const MENU_GROUPS: MenuGroup[] = [
  {
    // A mentor's workspace (mentor module). Administrators manage these from
    // their own sections, so the group is hidden for them.
    title: "Mentor desk",
    permission: "mentor:workflow",
    hideWith: "deletion:review",
    items: [
      { name: "Today", icon: Sun, path: "/today", exact: true },
      { name: "Attendance", icon: CalendarCheck, path: "/attendance" },
      { name: "Review inbox", icon: Inbox, path: "/reviews" },
      { name: "Doubts", icon: HelpCircle, path: "/doubts" },
      { name: "My students", icon: Users, path: "/students", exact: true },
      { name: "My batches", icon: GraduationCap, path: "/cohorts" },
      { name: "Daily quiz", icon: CalendarDays, path: "/daily-quiz" },
      { name: "Student reports", icon: FileText, path: "/student-reports" },
      { name: "Announcements", icon: Megaphone, path: "/announcements" },
      { name: "Shout-outs", icon: Sparkles, path: "/shoutouts" },
      { name: "My requests", icon: ShieldCheck, path: "/approvals" },
      { name: "My profile", icon: UserRound, path: "/profile" },
    ],
  },
  {
    title: "Menu",
    items: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        path: "/dashboard",
        exact: true,
        permission: "analytics:admin",
      },
      {
        name: "Approvals",
        icon: ShieldCheck,
        path: "/approvals",
        permission: "deletion:review",
      },
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
            permission: "courses:manage",
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
          { name: "Question reports", path: "/assessment/reports", permission: "question:manage" },
          { name: "Sketch review", path: "/assessment/sketches", permission: "assignment:review" },
          { name: "Rating sets", path: "/assessment/rating-sets", permission: "assignment:review" },
          {
            name: "Reported sketches",
            path: "/assessment/sketch-reports",
            permission: "assignment:review",
          },
        ],
      },
      {
        name: "Content",
        icon: BookOpen,
        subItems: [{ name: "Courses", path: "/content/courses", permission: "content:manage" }],
      },
      {
        name: "Students",
        icon: GraduationCap,
        subItems: [
          { name: "Colleges", path: "/colleges", permission: "colleges:manage", exact: true },
          { name: "Webinars", path: "/colleges/webinars", permission: "colleges:manage" },
          { name: "Enquiries", path: "/colleges/enquiries", permission: "colleges:manage" },
          { name: "Batches", path: "/cohorts", permission: "batches:manage" },
          { name: "Attendance", path: "/attendance", permission: "batches:manage" },
          { name: "Student reports", path: "/student-reports", permission: "batches:manage" },
          { name: "Daily quiz calendar", path: "/daily-quiz", permission: "batches:manage" },
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
          { name: "Mentor performance", path: "/mentors/performance", permission: "mentor:manage" },
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
