"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import { Bell, ChevronDown, LogOut, Menu, Search, User as UserIcon } from "lucide-react";
import { cn } from "@examora/ui";
import { useNotificationsApi } from "@/lib/notifications-api";

function useUnreadCount() {
  const api = useNotificationsApi();
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    api
      .unreadCount()
      .then((res) => setUnread(res.unread))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return unread;
}

function SearchField() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No cross-module search endpoint exists yet — routes into the course
    // catalog, the closest real destination for a course/lesson search.
    router.push("/courses");
  }

  return (
    <form onSubmit={handleSubmit} className="hidden max-w-md flex-1 sm:block">
      <label htmlFor="global-search" className="sr-only">
        Search courses, lessons, discussions
      </label>
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses, lessons, discussions…"
          className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-14 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
          ⌘K
        </kbd>
      </div>
    </form>
  );
}

function AvatarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const initials = (user?.firstName?.[0] ?? user?.email[0] ?? "?").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initials}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="hidden text-neutral-400 sm:block"
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-card border border-neutral-900/[0.06] bg-white p-1.5 shadow-soft-hover"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-neutral-900">
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Signed in"}
            </p>
            <p className="truncate text-xs text-neutral-500">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <UserIcon size={16} strokeWidth={1.75} aria-hidden="true" />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const unread = useUnreadCount();

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-neutral-900/[0.06] bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <SearchField />
      <button
        type="button"
        onClick={() => document.getElementById("global-search")?.focus()}
        aria-label="Search"
        className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:hidden"
      >
        <Search size={20} aria-hidden="true" />
      </button>

      <div className="flex-1" />

      <Link
        href="/notifications"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative rounded-md p-2 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white",
            )}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>

      <AvatarMenu />
    </header>
  );
}
