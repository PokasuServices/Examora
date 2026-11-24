"use client";

import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { useLoad } from "@/components/student/use-load";
import { useStudentApi } from "@/lib/student-api";
import { isStudentView } from "@/lib/student-view";

/**
 * Settings: the courses an admin has licensed to the student and the
 * classrooms (cohorts) they belong to. Students only; nothing is bought here.
 */
export function MyCoursesCard() {
  const { user } = useAuth();
  const student = isStudentView(user);
  const api = useStudentApi();
  const { data } = useLoad(() => api.profile(), student ? "settings-courses" : null);
  if (!student || !data) return null;

  return (
    <Card>
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <IconBadge icon={BookOpen} tone="primary" />
            <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">My courses</h2>
          </div>
          {data.courses.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              No courses yet. Your institute assigns courses to you.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {data.courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href="/learn"
                    className="text-sm text-neutral-700 hover:text-primary-600 dark:text-neutral-300"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <div className="flex items-center gap-2">
            <IconBadge icon={Users} tone="primary" />
            <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">
              My classrooms
            </h2>
          </div>
          {data.cohorts.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              You aren&rsquo;t in a classroom yet.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.cohorts.map((c) => (
                <li
                  key={c.id}
                  className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
                    {c.name}
                  </p>
                  {c.batch ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Batch: {c.batch}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
