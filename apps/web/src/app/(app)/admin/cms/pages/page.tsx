"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";
import { useCmsList } from "@/components/admin-cms/use-cms-list";
import { CmsListPageShell } from "@/components/admin-cms/cms-list-page-shell";
import { CmsListTable } from "@/components/admin-cms/cms-list-table";
import { PageCreateForm } from "@/components/admin-cms/pages-forms";

function PagesListContent() {
  const router = useRouter();
  const api = useCmsApi();
  const { status, items, total, page, pageCount, setPage, statusFilter, setStatusFilter, retry } =
    useCmsList(api.pages.list);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(input: {
    pageType: "LANDING" | "STATIC";
    slug: string;
    title: string;
    body: string;
  }): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.pages.create(input);
      router.push(`/admin/cms/pages/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create page.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsListPageShell
      heading="Pages"
      subtitle="Landing pages and static pages."
      status={status}
      total={total}
      isEmpty={items.length === 0}
      page={page}
      pageCount={pageCount}
      setPage={setPage}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      onRetry={retry}
      formOpen={formOpen}
      onOpenCreate={() => setFormOpen(true)}
      createForm={
        <PageCreateForm
          submitting={submitting}
          error={error}
          onSubmit={(input) => void handleCreate(input)}
          onCancel={() => setFormOpen(false)}
        />
      }
      table={
        <CmsListTable
          items={items}
          getTitle={(item) => `${item.title} (${item.pageType})`}
          itemHref={(item) => `/admin/cms/pages/${item.id}`}
        />
      }
    />
  );
}

export default function PagesListPage() {
  return (
    <RequirePermission permission="cms:manage">
      <PagesListContent />
    </RequirePermission>
  );
}
