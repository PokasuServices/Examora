import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  ListChecks,
  MessageSquarePlus,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Task-shortcuts (verbs), not a second sidebar of destinations (nouns) — see
// design spec §2.12. "Book a mentor session" and "View certificates" from
// the original spec aren't real product capabilities (no mentor-scheduling
// or certificates feature exists anywhere in the platform), swapped for
// real destinations.
const ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/courses", label: "Browse courses", icon: BookOpen },
  { href: "/quizzes", label: "Take a quiz", icon: ListChecks },
  { href: "/community", label: "Ask the community", icon: MessageSquarePlus },
  { href: "/recommendations", label: "See recommendations", icon: Sparkles },
  { href: "/analytics", label: "View analytics", icon: BarChart3 },
  { href: "/orders", label: "My purchases", icon: ShoppingBag },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Quick actions
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-start gap-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:border-primary-200 dark:hover:border-primary-500/30 hover:bg-primary-50/50 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
