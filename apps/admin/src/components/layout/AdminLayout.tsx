"use client";

import * as React from "react";
import { cn } from "@examora/ui";
import { useSidebar } from "@/context/SidebarContext";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { Backdrop } from "./Backdrop";

/**
 * TMS `layout/AdminLayout.vue` — fixed collapsible sidebar + backdrop,
 * with the content column offset by the rail width (sidebar-max expanded /
 * sidebar-min collapsed, widening while the collapsed rail is hovered) and a
 * sticky header on top. Content gets the TMS page padding; pages are full-width.
 */
export function AdminLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isExpanded, isHovered } = useSidebar();
  const wide = isExpanded || isHovered;

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out",
          wide
            ? "lg:ml-sidebar-max lg:max-w-[calc(100%-theme(spacing.sidebar-max))]"
            : "lg:ml-sidebar-min lg:max-w-[calc(100%-theme(spacing.sidebar-min))]",
        )}
      >
        <AppHeader />
        <div
          className={cn(
            "relative mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-3",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
