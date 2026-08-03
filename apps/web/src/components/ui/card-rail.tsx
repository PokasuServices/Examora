"use client";

import * as React from "react";
import { cn } from "@examora/ui";

/** Horizontally-scrolling card row with a right-edge fade-mask hinting "more to scroll." */
export function CardRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        tabIndex={-1}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-neutral-50 to-transparent"
      />
    </div>
  );
}
