import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import type { QuickFilter } from "./types";

// "Popular" from the original spec is deliberately omitted: the only
// candidate backend signal (CourseRecommendationService's fallback) reuses
// the catalog's plain default ordering and labels it "Popular on the
// platform" with no real enrollment-count or activity ranking behind it —
// surfacing that as a genuine popularity filter would be showing fabricated
// signal, not real data.
const OPTIONS: SegmentedOption<QuickFilter>[] = [
  { value: "all", label: "All courses" },
  { value: "continue", label: "Continue learning" },
  { value: "recommended", label: "Recommended" },
  { value: "recent", label: "Recently viewed" },
];

export function QuickActionsBar({
  value,
  onChange,
}: {
  value: QuickFilter;
  onChange: (value: QuickFilter) => void;
}) {
  return (
    <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <SegmentedControl
        options={OPTIONS}
        value={value}
        onChange={onChange}
        aria-label="Filter courses by"
      />
    </div>
  );
}
