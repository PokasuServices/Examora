"use client";

import * as React from "react";

/**
 * Sidebar state — React port of the TMS `composables/useSidebar.ts`
 * (TailAdmin): desktop expanded/collapsed rail, hover-to-peek while
 * collapsed, mobile drawer, and the single open submenu key.
 */
interface SidebarContextValue {
  /** Desktop rail expanded (`sidebar-max`) vs collapsed (`sidebar-min`). Always false below `lg`. */
  isExpanded: boolean;
  isMobileOpen: boolean;
  /** Pointer is over the collapsed rail — it temporarily widens to show labels. */
  isHovered: boolean;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setIsHovered: (hovered: boolean) => void;
  toggleSubmenu: (key: string) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

const DESKTOP_BREAKPOINT = 1024;

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [openSubmenu, setOpenSubmenu] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < DESKTOP_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      isExpanded: isMobile ? false : isExpanded,
      isMobileOpen,
      isHovered,
      openSubmenu,
      toggleSidebar: () => {
        if (window.innerWidth < DESKTOP_BREAKPOINT) setIsMobileOpen((o) => !o);
        else setIsExpanded((e) => !e);
      },
      toggleMobileSidebar: () => setIsMobileOpen((o) => !o),
      closeMobileSidebar: () => setIsMobileOpen(false),
      setIsHovered,
      toggleSubmenu: (key: string) => setOpenSubmenu((current) => (current === key ? null : key)),
    }),
    [isMobile, isExpanded, isMobileOpen, isHovered, openSubmenu],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
