import Link from "next/link";
import {
  ClipboardList,
  FileText,
  FlaskConical,
  FolderTree,
  HelpCircle,
  LayoutTemplate,
  ListChecks,
  MessageSquare,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_LINKS } from "./admin-links";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
}

const ACTIONS: QuickAction[] = [
  { label: "Users", href: "/admin/users", icon: Users, external: false },
  { label: "Content", href: "/admin/content", icon: FolderTree, external: false },
  { label: "CMS", href: "/admin/cms", icon: LayoutTemplate, external: false },
  { label: "Reports", href: "/admin/reports", icon: FileText, external: false },
  { label: "Assignments", href: ADMIN_LINKS.assignments, icon: ClipboardList, external: true },
  { label: "Quizzes", href: ADMIN_LINKS.quizzes, icon: ListChecks, external: true },
  { label: "Commerce", href: ADMIN_LINKS.commerce, icon: ShoppingBag, external: true },
  { label: "Notifications", href: ADMIN_LINKS.notifications, icon: HelpCircle, external: true },
  { label: "Mentors", href: ADMIN_LINKS.mentors, icon: Users, external: true },
  { label: "Forums", href: ADMIN_LINKS.forums, icon: MessageSquare, external: true },
  { label: "Feature flags", href: ADMIN_LINKS.featureFlags, icon: FlaskConical, external: true },
];

/**
 * Users/Content/CMS/Reports now have native, more complete apps/web
 * equivalents (search/filters/audit trail) — those link internally.
 * Assignments/Quizzes/Commerce/Notifications/Mentors/Forums/Feature-flags
 * management still lives only in apps/admin, so those link out to the real,
 * working pages there.
 */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Quick actions
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const className =
            "flex flex-col items-start gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:border-primary-200 dark:hover:border-primary-500/30 hover:bg-primary-50/50 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
          if (action.external) {
            return (
              <a
                key={action.label}
                href={action.href}
                target="_blank"
                rel="noreferrer"
                className={className}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {action.label}
              </a>
            );
          }
          return (
            <Link key={action.label} href={action.href} className={className}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
