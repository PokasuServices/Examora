"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, CalendarDays, Landmark, Search } from "lucide-react";
import { COLLEGE_CATEGORIES, type CollegeCategory } from "@examora/types";
import { Input, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import {
  CATEGORY_LABEL,
  CollegeLogo,
  formatFee,
  formatWhen,
} from "@/components/student/college-visuals";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentApi } from "@/lib/student-api";

function CollegesContent() {
  const api = useStudentApi();
  const [category, setCategory] = React.useState<CollegeCategory | "ALL" | "SHORTLIST">("ALL");
  const [query, setQuery] = React.useState("");
  const list = useLoad(
    () =>
      category === "SHORTLIST"
        ? api.shortlist()
        : api.colleges(category === "ALL" ? undefined : category),
    category,
  );
  const webinars = useLoad(() => api.webinars(), "webinars");

  const q = query.trim().toLowerCase();
  const colleges = (list.data ?? []).filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
  );
  const filters: { value: typeof category; label: string }[] = [
    { value: "ALL", label: "All" },
    ...COLLEGE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
    { value: "SHORTLIST", label: "My shortlist" },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Colleges"
        subtitle="Explore colleges, shortlist the ones you like, and ask them questions."
      />

      {webinars.data && webinars.data.length > 0 ? (
        <Card>
          <h2 className="flex items-center gap-2 text-base font-medium text-neutral-800 dark:text-white/90">
            <CalendarDays size={18} aria-hidden="true" /> Upcoming webinars
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {webinars.data.slice(0, 4).map((w) => (
              <li key={w.id}>
                <Link
                  href={`/webinars/${w.slug}`}
                  className="block rounded-md border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]"
                >
                  <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                    {w.title}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {formatWhen(w.startsAt, w.endsAt)}
                  </span>
                  {w.registered ? <Chip tone="success">Registered</Chip> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card density="compact" className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Filter colleges" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={category === f.value}
              onClick={() => setCategory(f.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                category === f.value
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            type="search"
            aria-label="Search colleges"
            placeholder="Search name or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {list.errorStatus !== null ? (
        <ErrorPanel status={list.errorStatus} onRetry={list.reload} />
      ) : list.loading || !list.data ? (
        <LoadingPanel />
      ) : colleges.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            heading={category === "SHORTLIST" ? "Your shortlist is empty" : "No colleges found"}
            body={
              category === "SHORTLIST"
                ? "Bookmark colleges to compare them here."
                : "Try another filter or search."
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {colleges.map((c) => (
            <li key={c.id}>
              <Card interactive className="relative flex h-full gap-4">
                <CollegeLogo src={c.logoUrl} name={c.name} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">
                    <Link
                      href={`/colleges/${c.slug}`}
                      className="after:absolute after:inset-0 after:rounded-card"
                    >
                      {c.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-neutral-500">{c.city}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.categories.map((cat) => (
                      <Chip key={cat} tone="neutral">
                        {CATEGORY_LABEL[cat]}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {formatFee(c.applicationFee)}
                  </p>
                </div>
                {c.shortlisted ? (
                  <Bookmark
                    size={16}
                    aria-label="Shortlisted"
                    className="shrink-0 fill-primary-600 text-primary-600"
                  />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function CollegesPage() {
  return (
    <RequireAuth>
      <CollegesContent />
    </RequireAuth>
  );
}
