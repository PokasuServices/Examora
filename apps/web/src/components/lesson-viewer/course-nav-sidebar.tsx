"use client";

import * as React from "react";
import { Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Curriculum } from "@examora/types";
import { CurriculumAccordion } from "@/components/course-detail/curriculum-accordion";
import { FiltersSheet } from "@/components/courses/filters-sheet";

/**
 * Reuses Course Details' CurriculumAccordion verbatim (with the new
 * currentLessonId highlight prop) as the lesson list, and the Catalog
 * page's mobile FiltersSheet verbatim as the drawer shell — no new
 * accordion or drawer implementation. Quiz/assignment indicator chips are
 * intentionally omitted here (subjectStats=null): showing them would need
 * two extra API calls on the single most frequently loaded page in the
 * app; they already live on Course Details where that cost is paid once.
 */
export function DesktopCourseNav({
  courseId,
  curriculum,
  currentLessonId,
  collapsed,
  onToggleCollapse,
}: {
  courseId: string;
  curriculum: Curriculum;
  currentLessonId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside className={collapsed ? "hidden" : "hidden shrink-0 basis-[300px] lg:block"}>
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-card border border-neutral-900/[0.06] bg-white p-4 shadow-soft">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-neutral-900">Course content</p>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse course navigation"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <PanelRightClose size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <CurriculumAccordion
          courseId={courseId}
          curriculum={curriculum}
          subjectStats={null}
          currentLessonId={currentLessonId}
          showHeading={false}
        />
      </div>
    </aside>
  );
}

export function CollapsedNavToggle({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Show course navigation"
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-100 lg:flex"
    >
      <PanelRightOpen size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function MobileCourseNavTrigger({
  courseId,
  curriculum,
  currentLessonId,
}: {
  courseId: string;
  curriculum: Curriculum;
  currentLessonId: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Course content"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-100 lg:hidden"
      >
        <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <FiltersSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Course content"
        footerLabel="Close"
      >
        <CurriculumAccordion
          courseId={courseId}
          curriculum={curriculum}
          subjectStats={null}
          currentLessonId={currentLessonId}
          showHeading={false}
        />
      </FiltersSheet>
    </>
  );
}
