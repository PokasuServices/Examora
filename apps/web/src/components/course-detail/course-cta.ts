import type { CourseProgress } from "@examora/types";
import type { AccessState, PurchaseState } from "./types";

export interface CourseCta {
  label: string;
  disabled: boolean;
  action: "buy" | "continue" | "none";
}

/** The one primary CTA definition, shared by the Hero and the Sidebar Summary so they never disagree. */
export function getCourseCta(
  access: AccessState,
  progress: CourseProgress | null,
  purchaseState: PurchaseState,
): CourseCta {
  if (access === "checking") {
    return { label: "Loading…", disabled: true, action: "none" };
  }
  if (access === "locked") {
    const busy = purchaseState === "starting" || purchaseState === "confirming";
    return {
      label:
        purchaseState === "starting"
          ? "Starting checkout…"
          : purchaseState === "confirming"
            ? "Confirming payment…"
            : "Buy now",
      disabled: busy,
      action: "buy",
    };
  }
  if (progress && progress.nextLesson) {
    return {
      label: progress.completedLessons > 0 ? "Continue learning" : "Start learning",
      disabled: false,
      action: "continue",
    };
  }
  return { label: "Completed", disabled: true, action: "none" };
}
