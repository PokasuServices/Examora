"use client";

import * as React from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { cn } from "@examora/ui";
import { useClickOutside } from "@/hooks/useClickOutside";

/** Clap (the community's "like"): a toggle with a running count. */
export function ClapButton({
  clapped,
  count,
  onToggle,
  size = "md",
  label = "Clap",
}: {
  clapped: boolean;
  count: number;
  onToggle: () => void | Promise<void>;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      aria-pressed={clapped}
      aria-label={`${clapped ? "Clapped" : label}, ${count} ${count === 1 ? "clap" : "claps"}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        clapped
          ? "border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-500/40 dark:bg-warning-500/15 dark:text-warning-200"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.03]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("leading-none", size === "sm" ? "text-sm" : "text-base")}
      >
        👏
      </span>
      <span>{clapped ? "Clapped" : label}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function shareTargets(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { name: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
}

/**
 * Share menu for a discussion: WhatsApp, X, Facebook, copy link — and the
 * device's own share sheet where the browser supports it.
 */
export function ShareMenu({
  path,
  title,
  size = "md",
}: {
  /** App path of the thing being shared, e.g. /community/threads/<id>. */
  path: string;
  title: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const menuId = React.useId();

  const url = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is still reachable from the page.
    }
    setOpen(false);
  }

  async function nativeShare() {
    setOpen(false);
    await navigator.share({ title, url: url() }).catch(() => undefined);
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 font-medium text-neutral-600 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.03]",
          size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        {copied ? (
          <>
            <Check size={14} aria-hidden="true" /> Copied
          </>
        ) : (
          <>
            <Share2 size={14} strokeWidth={1.75} aria-hidden="true" /> Share
          </>
        )}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Share "${title}"`}
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
        >
          {canNativeShare ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => void nativeShare()}
              className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/5"
            >
              Share via…
            </button>
          ) : null}
          {shareTargets(typeof window === "undefined" ? path : url(), title).map((t) => (
            <a
              key={t.name}
              role="menuitem"
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/5"
            >
              {t.name}
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => void copy()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            <Link2 size={14} aria-hidden="true" /> Copy link
          </button>
        </div>
      ) : null}
    </div>
  );
}
