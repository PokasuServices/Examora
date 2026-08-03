"use client";

import * as React from "react";
import { cn } from "@examora/ui";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** role="radiogroup" of role="radio" options, arrow-key navigable — used for the dashboard's time-scope toggle. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    const next = options[nextIndex];
    if (!next) return;
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-full bg-neutral-100 p-1"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              selected
                ? "bg-white text-neutral-900 shadow-soft"
                : "text-neutral-500 hover:text-neutral-700",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
