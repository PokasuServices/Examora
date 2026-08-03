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
        className="font-heading text-lg font-semibold text-neutral-900"
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
              className="flex flex-col items-start gap-2 rounded-md border border-neutral-900/[0.06] bg-white p-3 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-200 hover:bg-primary-50/50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
