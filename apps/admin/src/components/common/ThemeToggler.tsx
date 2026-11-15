"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

/** TMS `common/ThemeToggler.vue` — round sun/moon button that flips light ↔ dark. */
export function ThemeToggler() {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={isDarkMode ? "Light mode" : "Dark mode"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
    >
      {/* Both icons render; CSS swaps them so the server markup never mismatches. */}
      <Moon size={20} strokeWidth={1.75} aria-hidden="true" className="dark:hidden" />
      <Sun size={20} strokeWidth={1.75} aria-hidden="true" className="hidden dark:block" />
    </button>
  );
}
