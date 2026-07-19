"use client";

import type { ContentStatus } from "@examora/types";
import { Button } from "@examora/ui";

/**
 * Renders the valid status-transition buttons for a content node, mirroring the
 * server-side rules in content-status.util.ts (ADR-0012).
 */
export function StatusActions({
  status,
  onChange,
  disabled,
}: {
  status: ContentStatus;
  onChange: (next: ContentStatus) => void;
  disabled?: boolean;
}) {
  const targets: { label: string; next: ContentStatus }[] = [];
  if (status === "DRAFT") {
    targets.push({ label: "Publish", next: "PUBLISHED" }, { label: "Archive", next: "ARCHIVED" });
  } else if (status === "PUBLISHED") {
    targets.push({ label: "Unpublish", next: "DRAFT" }, { label: "Archive", next: "ARCHIVED" });
  } else {
    targets.push({ label: "Restore to draft", next: "DRAFT" });
  }

  return (
    <div className="flex gap-2">
      {targets.map((t) => (
        <Button key={t.next} variant="ghost" disabled={disabled} onClick={() => onChange(t.next)}>
          {t.label}
        </Button>
      ))}
    </div>
  );
}
