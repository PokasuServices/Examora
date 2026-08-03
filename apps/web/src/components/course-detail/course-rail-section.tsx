import { CardRail } from "@/components/ui/card-rail";
import { CourseCard } from "@/components/dashboard/course-card";
import { CourseCardSkeleton } from "@/components/ui/skeleton";

interface RailItem {
  courseId: string;
  courseTitle: string;
  reason: string;
}

/** Generic course rail — reused for both Related Courses and Recommendations, the same rail/card the Dashboard already uses. */
export function CourseRailSection({
  title,
  status,
  items,
}: {
  title: string;
  status: "loading" | "error" | "ready";
  items: RailItem[];
}) {
  if (status === "error" || (status === "ready" && items.length === 0)) return null;

  return (
    <section aria-labelledby={`${title}-heading`.replace(/\s+/g, "-").toLowerCase()}>
      <h2
        id={`${title}-heading`.replace(/\s+/g, "-").toLowerCase()}
        className="font-heading text-xl font-semibold text-neutral-900"
      >
        {title}
      </h2>
      <div className="mt-4">
        <CardRail>
          {status === "loading"
            ? Array.from({ length: 3 }).map((_, i) => <CourseCardSkeleton key={i} />)
            : items.map((item) => (
                <CourseCard
                  key={item.courseId}
                  href={`/courses/${item.courseId}`}
                  title={item.courseTitle}
                  reason={item.reason}
                />
              ))}
        </CardRail>
      </div>
    </section>
  );
}
