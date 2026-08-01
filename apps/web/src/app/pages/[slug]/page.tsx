"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import type { CmsPageDto } from "@examora/types";
import { cmsPublicApi } from "@/lib/cms-public-api";

export default function CmsPageBySlug() {
  const params = useParams<{ slug: string }>();
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [page, setPage] = React.useState<CmsPageDto | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setNotFound(false);
    cmsPublicApi
      .getPageBySlug(params.slug)
      .then(setPage)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (notFound || !page) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          This page doesn&apos;t exist or isn&apos;t published.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-heading">{page.title}</h1>
      <div className="mt-6 whitespace-pre-wrap text-body text-neutral-700">{page.body}</div>
    </main>
  );
}
