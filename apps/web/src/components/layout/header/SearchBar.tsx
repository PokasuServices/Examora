"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** TMS `header/SearchBar.vue` — desktop search field with a ⌘K focus shortcut. */
export function SearchBar() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No cross-module search endpoint exists yet — routes into the course
    // catalog, the closest real destination for a course/lesson search.
    router.push("/courses");
  }

  return (
    <div className="hidden lg:block">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <label htmlFor="global-search" className="sr-only">
            Search courses, lessons, discussions
          </label>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            ref={inputRef}
            id="global-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, lessons, discussions…"
            className="h-11 w-full rounded-lg border border-neutral-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-neutral-800 shadow-theme-xs placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-neutral-800 dark:bg-white/[0.03] dark:text-white/90 xl:w-[430px]"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            aria-label="Focus search (Ctrl+K)"
            className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-neutral-200 bg-neutral-50 px-[7px] py-[4.5px] text-xs text-neutral-500 dark:border-neutral-800 dark:bg-white/[0.03] dark:text-neutral-400"
          >
            <span aria-hidden="true">⌘</span>
            <span aria-hidden="true">K</span>
          </button>
        </div>
      </form>
    </div>
  );
}
