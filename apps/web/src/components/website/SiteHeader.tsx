"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { buttonVariants, cn } from "@examora/ui";
import { AppLogo } from "@/components/common/AppLogo";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#mentoring", label: "Mentoring" },
  { href: "/announcements", label: "Announcements" },
  { href: "/faq", label: "FAQ" },
];

/** Public site header — logo, section links, Log in / Get started; collapses to a menu on mobile. */
export function SiteHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-screen-xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label="Examora home">
          <AppLogo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={buttonVariants({ variant: "normal", size: "sm" })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 lg:hidden"
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      <div
        id="site-mobile-nav"
        className={cn(
          "border-t border-neutral-200 bg-white px-4 pb-4 pt-2 shadow-theme-md lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/login" className={buttonVariants({ variant: "normal", size: "sm" })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
