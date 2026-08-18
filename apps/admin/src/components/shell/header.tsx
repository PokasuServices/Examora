"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { ChevronDown, LogOut, Menu } from "lucide-react";

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

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
          <a
            href={`${WEB_ORIGIN}/profile`}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            My profile
          </a>
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

      <Link
        href="/dashboard"
        className="font-heading text-sm font-semibold text-neutral-900 lg:hidden"
      >
        Examora Admin
      </Link>

      <div className="flex-1" />

      <AvatarMenu />
    </header>
  );
}
