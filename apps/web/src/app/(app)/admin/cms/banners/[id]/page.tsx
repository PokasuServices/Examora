"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import type { CmsAssetDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";
import { useCmsEditor } from "@/components/admin-cms/use-cms-editor";
import { CmsEditorPageShell } from "@/components/admin-cms/cms-editor-page-shell";
import { WorkflowActions } from "@/components/admin-cms/workflow-actions";
import { VersionHistoryPanel } from "@/components/admin-cms/version-history-panel";
import { BannerFieldsForm } from "@/components/admin-cms/banners-forms";

function BannerEditorContent({ id }: { id: string }) {
  const api = useCmsApi();
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);

  React.useEffect(() => {
    api.assets
      .list({ pageSize: 100 })
      .then((res) => setAssets(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    status,
    content,
    versions,
    versionsStatus,
    mutationStatus,
    mutationError,
    save,
    transition,
    schedulePublish,
    scheduleUnpublish,
    restoreVersion,
    compareVersions,
    retry,
  } = useCmsEditor(id, api.banners);

  return (
    <CmsEditorPageShell
      backHref="/admin/cms/banners"
      backLabel="Banners"
      title={content?.title ?? "Banner"}
      status={status}
      onRetry={retry}
      workflowActions={
        content ? (
          <WorkflowActions
            status={content.status}
            scheduledPublishAt={content.scheduledPublishAt}
            scheduledUnpublishAt={content.scheduledUnpublishAt}
            publishedAt={content.publishedAt}
            mutationStatus={mutationStatus}
            mutationError={mutationError}
            onTransition={transition}
            onSchedulePublish={schedulePublish}
            onScheduleUnpublish={scheduleUnpublish}
          />
        ) : null
      }
      fieldsForm={
        content ? (
          <BannerFieldsForm
            banner={content}
            assets={assets}
            editable={content.status === "DRAFT"}
            submitting={mutationStatus === "submitting"}
            error={mutationError}
            onSave={(input) => void save(input)}
          />
        ) : null
      }
      versionHistory={
        <VersionHistoryPanel
          status={versionsStatus}
          versions={versions}
          mutationStatus={mutationStatus}
          mutationError={mutationError}
          onCompare={compareVersions}
          onRestore={restoreVersion}
          onRetry={retry}
        />
      }
    />
  );
}

export default function BannerEditorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="cms:manage">
      <BannerEditorContent id={id} />
    </RequirePermission>
  );
}
