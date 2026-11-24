import { Landmark } from "lucide-react";
import type { CollegeCategory } from "@examora/types";
import { StudyImage } from "./study-image";

export const CATEGORY_LABEL: Record<CollegeCategory, string> = {
  ARCHITECTURE: "Architecture",
  DESIGN: "Design",
  FASHION: "Fashion",
  STUDY_ABROAD: "Study abroad",
};

/** College logo, or a neutral building icon when none is uploaded. */
export function CollegeLogo({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800">
      <StudyImage src={src} alt={`${name} logo`} className="max-h-12 rounded-none" />
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-600"
    >
      <Landmark size={24} strokeWidth={1.5} />
    </span>
  );
}

export function formatFee(fee: number | null): string {
  return fee === null ? "Fee not published" : `Application fee ₹${fee.toLocaleString("en-IN")}`;
}

export function formatWhen(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const t = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t(s)} – ${t(e)}`;
}
