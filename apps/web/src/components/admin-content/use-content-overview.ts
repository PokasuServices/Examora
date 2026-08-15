"use client";

import * as React from "react";
import { useContentApi } from "@/lib/content-api";

type Status = "loading" | "ready" | "error";

/**
 * Subjects/Topics/Modules/Lessons have no platform-wide count endpoint —
 * /admin/content/{subjects|topics|modules|lessons} requires a parent scope
 * (courseId/subjectId/topicId/moduleId) on every list call, so a true total
 * would mean cascading through every course's full hierarchy. That's not a
 * real "available statistic" — it's omitted rather than approximated.
 * Categories and Courses have no such scoping requirement, so their totals
 * (and Course's real status breakdown) are fetched directly via `total`
 * from a pageSize=1 call — cheap and exact regardless of dataset size.
 */
export function useContentOverview() {
  const api = useContentApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [categoryTotal, setCategoryTotal] = React.useState(0);
  const [activeCategoryTotal, setActiveCategoryTotal] = React.useState(0);
  const [courseTotal, setCourseTotal] = React.useState(0);
  const [draftCourseTotal, setDraftCourseTotal] = React.useState(0);
  const [publishedCourseTotal, setPublishedCourseTotal] = React.useState(0);
  const [archivedCourseTotal, setArchivedCourseTotal] = React.useState(0);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      api.listCategories({ pageSize: 1 }),
      api.listCategories({ pageSize: 1, isActive: true }),
      api.listCourses({ pageSize: 1 }),
      api.listCourses({ pageSize: 1, status: "DRAFT" }),
      api.listCourses({ pageSize: 1, status: "PUBLISHED" }),
      api.listCourses({ pageSize: 1, status: "ARCHIVED" }),
    ])
      .then(([categories, activeCategories, courses, draft, published, archived]) => {
        setCategoryTotal(categories.total);
        setActiveCategoryTotal(activeCategories.total);
        setCourseTotal(courses.total);
        setDraftCourseTotal(draft.total);
        setPublishedCourseTotal(published.total);
        setArchivedCourseTotal(archived.total);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return {
    status,
    categoryTotal,
    activeCategoryTotal,
    courseTotal,
    draftCourseTotal,
    publishedCourseTotal,
    archivedCourseTotal,
    retry: load,
  };
}
