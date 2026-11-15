"use client";

import { useSidebar } from "@/context/SidebarContext";

/** TMS `layout/Backdrop.vue` — dims the page behind the mobile sidebar drawer. */
export function Backdrop() {
  const { isMobileOpen, closeMobileSidebar } = useSidebar();
  if (!isMobileOpen) return null;
  return (
    <div
      className="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden"
      onClick={closeMobileSidebar}
      aria-hidden="true"
    />
  );
}
