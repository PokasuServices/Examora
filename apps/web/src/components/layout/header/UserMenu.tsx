"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@examora/ui";
import { useClickOutside } from "@/hooks/useClickOutside";
import { isStudentView } from "@/lib/student-view";

const MENU_ITEMS: { href: string; icon: LucideIcon; text: string }[] = [
  { href: "/profile", icon: UserIcon, text: "Edit profile" },
  { href: "/profile", icon: Settings, text: "Account settings" },
  { href: "/faq", icon: CircleHelp, text: "Support" },
];

/** Students' extra pages (not in their sidebar). Assignments moved to the sidebar. */
const STUDENT_MENU_ITEMS: { href: string; icon: LucideIcon; text: string }[] = [
  { href: "/quizzes", icon: ListChecks, text: "My quizzes" },
  { href: "/analytics", icon: BarChart3, text: "My analytics" },
  { href: "/notifications", icon: Bell, text: "Notifications" },
  { href: "/recommendations", icon: Sparkles, text: "Recommendations" },
  { href: "/profile", icon: Settings, text: "Account settings" },
  { href: "/faq", icon: CircleHelp, text: "Support" },
];

/**
 * TMS `header/UserMenu.vue` — initials avatar + name, dropdown with
 * name / email / role pill, account links, and Sign out.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() ||
    (user?.email[0] ?? "U").toUpperCase();
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "User";
  const role = user?.roles[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center text-neutral-700 focus-visible:outline-none dark:text-neutral-400"
      >
        <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white text-sm font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {initials}
        </span>
        <span className="mr-1 hidden text-sm font-medium sm:block">
          {user?.firstName ?? displayName}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "text-neutral-500 dark:text-neutral-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-neutral-200 bg-white p-3 shadow-theme-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div>
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-400">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {user?.email}
            </span>
            {role ? (
              <span className="mt-1 inline-block rounded-full bg-primary-100 dark:bg-primary-500/20 px-2 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-300">
                {role}
              </span>
            ) : null}
          </div>

          <ul className="flex flex-col gap-1 border-b border-neutral-200 pb-3 pt-4 dark:border-neutral-800">
            {(isStudentView(user) ? STUDENT_MENU_ITEMS : MENU_ITEMS).map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.text}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={close}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-300"
                  >
                    <Icon
                      size={22}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300"
                    />
                    {item.text}
                  </Link>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void logout();
            }}
            className="group mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-300"
          >
            <LogOut
              size={22}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300"
            />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
