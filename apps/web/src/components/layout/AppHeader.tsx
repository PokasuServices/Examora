"use client";

import * as React from "react";
import { Menu, MoreHorizontal, X } from "lucide-react";
import { cn } from "@examora/ui";
import { ThemeToggler } from "@/components/common/ThemeToggler";
import { useSidebar } from "@/context/SidebarContext";
import { HeaderLogo } from "./header/HeaderLogo";
import { NotificationMenu } from "./header/NotificationMenu";
import { SearchBar } from "./header/SearchBar";
import { UserMenu } from "./header/UserMenu";

/**
 * TMS `layout/AppHeader.vue` — sticky bar: sidebar toggle (collapses the
 * rail on desktop, opens the drawer on mobile), mobile logo, search, and
 * an application menu (notifications + user) that folds behind a "⋯"
 * button on small screens.
 */
export function AppHeader() {
  const { isMobileOpen, toggleSidebar } = useSidebar();
  const [appMenuOpen, setAppMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 flex w-full bg-white dark:bg-neutral-900 lg:bg-neutral-50 dark:lg:bg-neutral-950">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6 lg:py-2">
        <div className="flex w-full items-center justify-between gap-2 border-b border-neutral-200 px-3 py-3 dark:border-neutral-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:p-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isMobileOpen ? "Close navigation" : "Toggle navigation"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg border-neutral-200 text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:text-neutral-400 lg:h-11 lg:w-11 lg:border",
              isMobileOpen && "bg-neutral-100 dark:bg-neutral-800 lg:bg-transparent",
            )}
          >
            {isMobileOpen ? (
              <X size={24} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>

          <HeaderLogo />

          <SearchBar />

          <button
            type="button"
            onClick={() => setAppMenuOpen((o) => !o)}
            aria-label="More"
            aria-expanded={appMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 lg:hidden"
          >
            <MoreHorizontal size={24} aria-hidden="true" />
          </button>
        </div>

        <div
          className={cn(
            "w-full items-center justify-between gap-4 px-5 py-4 shadow-theme-md lg:flex lg:py-0 lg:justify-end lg:px-0 lg:shadow-none",
            appMenuOpen ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center gap-2">
            <ThemeToggler />
            <NotificationMenu />
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
