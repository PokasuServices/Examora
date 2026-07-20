"use client";

import * as React from "react";
import Link from "next/link";
import type { Course } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useLearningApi } from "@/lib/learning-api";

function CatalogContent() {
  const api = useLearningApi();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listCourses()
      .then((res) => setCourses(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Explore courses</h1>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          My learning →
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && courses.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No published courses yet.</p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}`}
            className="rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-primary-400"
          >
            <h2 className="text-lg font-semibold">{course.title}</h2>
            {course.examType ? (
              <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {course.examType}
              </span>
            ) : null}
            {course.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function CatalogPage() {
  return (
    <RequireAuth>
      <CatalogContent />
    </RequireAuth>
  );
}
