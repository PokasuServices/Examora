"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { PermissionCode, RoleName } from "@examora/types";
import { ChevronDown, ExternalLink, MoreHorizontal } from "lucide-react";
import { cn } from "@examora/ui";
import { AppLogo } from "@/components/common/AppLogo";
import { MENU_GROUPS, type MenuItem, type MenuSubItem } from "@/config/menu";
import { useSidebar } from "@/context/SidebarContext";

function matches(pathname: string | null, path: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

const ROLE_LABELS: Record<RoleName, string> = {
  ADMINISTRATOR: "Admin",
  MENTOR: "Mentor",
  REVIEWER: "Reviewer",
  GUARDIAN: "Guardian",
  STUDENT: "Student",
};

/** Highest-privilege role first, so the footer strip reads e.g. "Admin Dashboard". */
const ROLE_PRIORITY: RoleName[] = ["ADMINISTRATOR", "MENTOR", "REVIEWER", "GUARDIAN", "STUDENT"];

/**
 * TMS `layout/AppSidebar.vue` — fixed rail that collapses to icons,
 * peeks open on hover, slides in as a drawer on mobile; menu groups with
 * titles (dots when collapsed), flat links and expandable submenus, all
 * filtered by the signed-in user's permissions; role strip at the bottom.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    openSubmenu,
    setIsHovered,
    toggleSubmenu,
    closeMobileSidebar,
  } = useSidebar();
  const showLabels = isExpanded || isHovered || isMobileOpen;
  const permissions = user?.permissions ?? [];
  const hasAccess = (permission?: PermissionCode, hideWith?: PermissionCode) =>
    (!permission || permissions.includes(permission)) &&
    (!hideWith || !permissions.includes(hideWith));

  const role = ROLE_PRIORITY.find((r) => user?.roles.includes(r));
  const roleLabel = role ? ROLE_LABELS[role] : null;

  function visibleSubItems(item: MenuItem): MenuSubItem[] {
    return (item.subItems ?? []).filter((sub) => hasAccess(sub.permission, sub.hideWith));
  }

  /** The single active child: the longest matching path wins, so a section root doesn't light up alongside its own children. */
  function activeSubPath(item: MenuItem): string | null {
    let best: string | null = null;
    for (const sub of visibleSubItems(item)) {
      if (
        !sub.external &&
        matches(pathname, sub.path, sub.exact) &&
        (!best || sub.path.length > best.length)
      ) {
        best = sub.path;
      }
    }
    return best;
  }

  function isSubmenuOpen(key: string, item: MenuItem): boolean {
    // Same rule as TMS: explicitly opened, or contains the active route.
    return openSubmenu === key || activeSubPath(item) !== null;
  }

  function onNavigate() {
    if (isMobileOpen) closeMobileSidebar();
  }

  const groups = MENU_GROUPS.filter((group) => hasAccess(group.permission, group.hideWith))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          hasAccess(item.permission, item.hideWith) &&
          (!item.subItems || visibleSubItems(item).length > 0),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      aria-label="Main navigation"
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "no-scrollbar fixed left-0 top-0 z-50 mt-[65px] flex h-[calc(100vh-65px)] flex-col overflow-hidden border-r border-neutral-200 bg-white px-2 text-neutral-900 dark:text-white/90 transition-all duration-300 ease-in-out dark:border-neutral-800 dark:bg-neutral-900 lg:mt-0 lg:h-screen lg:translate-x-0",
        showLabels ? "w-sidebar-max" : "lg:w-sidebar-min",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div
        className={cn("hidden py-6 lg:flex", showLabels ? "justify-start px-2" : "justify-center")}
      >
        <Link href="/" aria-label="Examora home">
          <AppLogo variant={showLabels ? "full" : "icon"} />
        </Link>
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-14 pt-4 duration-300 ease-linear lg:pt-0">
        <nav>
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.title}>
                <h2
                  className={cn(
                    "mb-2 flex px-2 text-xs uppercase leading-5 text-neutral-400 dark:text-neutral-500",
                    showLabels ? "justify-start" : "lg:justify-center",
                  )}
                >
                  {showLabels ? group.title : <MoreHorizontal size={20} aria-label={group.title} />}
                </h2>
                <ul className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const key = `${group.title}-${item.name}`;

                    if (item.subItems) {
                      const open = isSubmenuOpen(key, item);
                      const activePath = activeSubPath(item);
                      const childActive = activePath !== null;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggleSubmenu(key)}
                            aria-expanded={open}
                            title={showLabels ? undefined : item.name}
                            className={cn(
                              "menu-item group",
                              open || childActive ? "menu-item-active" : "menu-item-inactive",
                              showLabels ? "lg:justify-start" : "gap-0 lg:justify-center",
                            )}
                          >
                            <Icon
                              size={22}
                              strokeWidth={1.75}
                              aria-hidden="true"
                              className={cn(
                                "shrink-0",
                                open || childActive
                                  ? "menu-item-icon-active"
                                  : "menu-item-icon-inactive",
                              )}
                            />
                            <span
                              className={cn("menu-item-text", showLabels && "sidebar-expanded")}
                            >
                              {item.name}
                            </span>
                            {showLabels ? (
                              <ChevronDown
                                size={18}
                                aria-hidden="true"
                                className={cn(
                                  "ml-auto shrink-0 transition-transform duration-200",
                                  open && "rotate-180",
                                )}
                              />
                            ) : null}
                          </button>
                          {open && showLabels ? (
                            <ul className="ml-9 mt-1 space-y-1">
                              {visibleSubItems(item).map((sub) => {
                                const active = sub.path === activePath;
                                const subClass = cn(
                                  "menu-dropdown-item",
                                  active
                                    ? "menu-dropdown-item-active"
                                    : "menu-dropdown-item-inactive",
                                );
                                return (
                                  <li key={sub.path}>
                                    {sub.external ? (
                                      <a
                                        href={sub.path}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={subClass}
                                      >
                                        {sub.name}
                                        <ExternalLink
                                          size={14}
                                          className="ml-auto text-neutral-400 dark:text-neutral-500"
                                          aria-hidden="true"
                                        />
                                      </a>
                                    ) : (
                                      <Link
                                        href={sub.path}
                                        onClick={onNavigate}
                                        aria-current={active ? "page" : undefined}
                                        className={subClass}
                                      >
                                        {sub.name}
                                      </Link>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </li>
                      );
                    }

                    if (!item.path) return null;
                    const active = !item.external && matches(pathname, item.path, item.exact);
                    const linkClass = cn(
                      "menu-item group",
                      active ? "menu-item-active" : "menu-item-inactive",
                      showLabels ? "lg:justify-start" : "gap-0 lg:justify-center",
                    );
                    const content = (
                      <>
                        <Icon
                          size={22}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className={cn(
                            "shrink-0",
                            active ? "menu-item-icon-active" : "menu-item-icon-inactive",
                          )}
                        />
                        <span className={cn("menu-item-text", showLabels && "sidebar-expanded")}>
                          {item.name}
                        </span>
                      </>
                    );
                    return (
                      <li key={key}>
                        {item.external ? (
                          <a
                            href={item.path}
                            target="_blank"
                            rel="noreferrer"
                            title={showLabels ? undefined : item.name}
                            className={linkClass}
                          >
                            {content}
                          </a>
                        ) : (
                          <Link
                            href={item.path}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            title={showLabels ? undefined : item.name}
                            className={linkClass}
                          >
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {showLabels && roleLabel ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-primary-600/90 p-3 text-sm text-white">
          {roleLabel} Dashboard
        </div>
      ) : null}
    </aside>
  );
}
