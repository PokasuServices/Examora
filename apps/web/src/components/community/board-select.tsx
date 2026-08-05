import { ChevronDown } from "lucide-react";
import type { ForumBoard, ForumCategory } from "@examora/types";

/** Grouped-by-category board picker — native <select optgroup>, same styling approach as SelectField. */
export function BoardSelect({
  id,
  categories,
  boardsByCategory,
  value,
  onChange,
  disabled,
}: {
  id: string;
  categories: ForumCategory[];
  boardsByCategory: Record<string, ForumBoard[]>;
  value: string;
  onChange: (boardId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-neutral-500">
        Board
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-md border border-neutral-200 bg-white pl-3 pr-9 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-neutral-50 disabled:text-neutral-400"
        >
          <option value="" disabled>
            Choose a board…
          </option>
          {categories.map((category) => (
            <optgroup key={category.id} label={category.title}>
              {(boardsByCategory[category.id] ?? []).map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
