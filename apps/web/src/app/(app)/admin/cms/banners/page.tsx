"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { CmsAssetDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";
import { useCmsList } from "@/components/admin-cms/use-cms-list";
import { CmsListPageShell } from "@/components/admin-cms/cms-list-page-shell";
import { CmsListTable } from "@/components/admin-cms/cms-list-table";
import { BannerCreateForm } from "@/components/admin-cms/banners-forms";

function BannersListContent() {
  const router = useRouter();
  const api = useCmsApi();
  const { status, items, total, page, pageCount, setPage, statusFilter, setStatusFilter, retry } =
    useCmsList(api.banners.list);
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.assets
      .list({ pageSize: 100 })
      .then((res) => setAssets(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(input: {
    title: string;
    placement: string;
    imageAssetId?: string;
    linkUrl?: string;
  }): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.banners.create(input);
      router.push(`/admin/cms/banners/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create banner.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsListPageShell
      heading="Banners"
      subtitle="Promotional banners shown across the platform."
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
        <BannerCreateForm
          assets={assets}
          submitting={submitting}
          error={error}
          onSubmit={(input) => void handleCreate(input)}
          onCancel={() => setFormOpen(false)}
        />
      }
      table={
        <CmsListTable
          items={items}
          getTitle={(item) => `${item.title} (${item.placement})`}
          itemHref={(item) => `/admin/cms/banners/${item.id}`}
        />
      }
    />
  );
}

export default function BannersListPage() {
  return (
    <RequirePermission permission="cms:manage">
      <BannersListContent />
    </RequirePermission>
  );
}
