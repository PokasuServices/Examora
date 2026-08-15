"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";
import { useCmsEditor } from "@/components/admin-cms/use-cms-editor";
import { CmsEditorPageShell } from "@/components/admin-cms/cms-editor-page-shell";
import { WorkflowActions } from "@/components/admin-cms/workflow-actions";
import { VersionHistoryPanel } from "@/components/admin-cms/version-history-panel";
import { PageFieldsForm } from "@/components/admin-cms/pages-forms";

function PageEditorContent({ id }: { id: string }) {
  const api = useCmsApi();
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
  } = useCmsEditor(id, api.pages);

  return (
    <CmsEditorPageShell
      backHref="/admin/cms/pages"
      backLabel="Pages"
      title={content?.title ?? "Page"}
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
          <PageFieldsForm
            page={content}
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

export default function PageEditorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="cms:manage">
      <PageEditorContent id={id} />
    </RequirePermission>
  );
}
