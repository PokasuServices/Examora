import type { LearnCrumbs } from "@examora/types";
import type { BreadcrumbCrumb } from "@/components/ui/page-header";

/** Breadcrumb trail for Learn pages: Course › Subject › Topic (Home already points at Learn). */
export function learnTrail(crumbs: LearnCrumbs, upTo: "subject" | "topic"): BreadcrumbCrumb[] {
  const trail: BreadcrumbCrumb[] = [{ label: crumbs.course.title, href: "/learn" }];
  if (crumbs.subject) {
    trail.push({ label: crumbs.subject.title, href: `/learn/subjects/${crumbs.subject.id}` });
  }
  if (upTo === "topic" && crumbs.topic) {
    trail.push({ label: crumbs.topic.title, href: `/learn/topics/${crumbs.topic.id}` });
  }
  return trail;
}
