import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectFieldOption {
  value: string;
  label: string;
}

/** Native <select> styled to match the design system. Mirrors apps/web's SelectField exactly. */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-500">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-md border border-neutral-200 bg-white pl-3 pr-9 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
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
