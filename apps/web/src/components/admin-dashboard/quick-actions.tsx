import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutTemplate,
  ListChecks,
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
  { label: "Users", href: ADMIN_LINKS.users, icon: Users, external: true },
  { label: "Courses", href: ADMIN_LINKS.courses, icon: BookOpen, external: true },
  { label: "Assignments", href: ADMIN_LINKS.assignments, icon: ClipboardList, external: true },
  { label: "Quizzes", href: ADMIN_LINKS.quizzes, icon: ListChecks, external: true },
  { label: "CMS", href: ADMIN_LINKS.cms, icon: LayoutTemplate, external: true },
  { label: "Commerce", href: ADMIN_LINKS.commerce, icon: ShoppingBag, external: true },
  { label: "Notifications", href: ADMIN_LINKS.notifications, icon: HelpCircle, external: true },
  { label: "Reports", href: "/admin/reports", icon: FileText, external: false },
];

/**
 * Users/Courses/Assignments/Quizzes/CMS/Commerce/Notifications management
 * already lives in apps/admin — this redesign doesn't rebuild that CRUD
 * surface, so those six link out to the real, working pages there. Reports
 * already has a premium apps/web equivalent (built in the Analytics phase)
 * and links internally.
 */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Quick actions
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const className =
            "flex flex-col items-start gap-2 rounded-md border border-neutral-900/[0.06] bg-white p-3 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
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
