"use client";

import * as React from "react";

/**
 * React port of TMS `common/v-click-outside` — calls `onOutside` on a
 * pointer-down outside `ref` or on Escape, while `active` is true.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  active = true,
) {
  React.useEffect(() => {
    if (!active) return;
    function handlePointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ref, onOutside, active]);
}
