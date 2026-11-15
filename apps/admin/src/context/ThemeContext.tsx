"use client";

import * as React from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

/**
 * Theme state — React port of the TMS `layout/ThemeProvider.vue`: light
 * by default, the choice persisted in localStorage("theme"), applied as
 * the `dark` class on <html> (Tailwind `darkMode: "class"`). The root
 * layout's THEME_INIT_SCRIPT (lib/theme.ts) applies it before first paint.
 */
type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "dark") setTheme("dark");
    } catch {
      // Storage blocked (private mode etc.) — stay on the light default.
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Non-persistent this session; the toggle still works.
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ theme, isDarkMode: theme === "dark", toggleTheme }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
