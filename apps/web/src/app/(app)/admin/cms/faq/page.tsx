"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";
import { useCmsList } from "@/components/admin-cms/use-cms-list";
import { CmsListPageShell } from "@/components/admin-cms/cms-list-page-shell";
import { CmsListTable } from "@/components/admin-cms/cms-list-table";
import { FaqCreateForm } from "@/components/admin-cms/faq-forms";

function FaqListContent() {
  const router = useRouter();
  const api = useCmsApi();
  const { status, items, total, page, pageCount, setPage, statusFilter, setStatusFilter, retry } =
    useCmsList(api.faq.list);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(input: {
    question: string;
    answer: string;
    category?: string;
  }): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.faq.create(input);
      router.push(`/admin/cms/faq/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create FAQ item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsListPageShell
      heading="FAQ"
      subtitle="Frequently asked questions shown to students."
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
        <FaqCreateForm
          submitting={submitting}
          error={error}
          onSubmit={(input) => void handleCreate(input)}
          onCancel={() => setFormOpen(false)}
        />
      }
      table={
        <CmsListTable
          items={items}
          getTitle={(item) => item.question}
          itemHref={(item) => `/admin/cms/faq/${item.id}`}
        />
      }
    />
  );
}

export default function FaqListPage() {
  return (
    <RequirePermission permission="cms:manage">
      <FaqListContent />
    </RequirePermission>
  );
}
