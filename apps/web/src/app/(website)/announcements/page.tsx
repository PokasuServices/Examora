"use client";

import * as React from "react";
import type { CmsAnnouncementDto } from "@examora/types";
import { cmsPublicApi } from "@/lib/cms-public-api";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AnnouncementsPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<CmsAnnouncementDto[]>([]);

  React.useEffect(() => {
    setLoading(true);
    cmsPublicApi
      .listAnnouncements()
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-heading">Announcements</h1>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No announcements published yet.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-medium text-neutral-900">{item.title}</h2>
                <span className="shrink-0 text-xs text-neutral-500">
                  {formatDate(item.publishedAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{item.body}</p>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}
