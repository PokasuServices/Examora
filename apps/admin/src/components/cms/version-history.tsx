"use client";

import * as React from "react";
import type { CmsContentVersionDto, CmsVersionDiffEntry } from "@examora/types";
import { Button } from "@examora/ui";

/** Content Version History / Compare Versions / Restore Version (ADR-0022 §3), shared by every CMS content type. */
export function VersionHistory({
  versions,
  onCompare,
  onRestore,
}: {
  versions: CmsContentVersionDto[];
  onCompare: (from: number, to: number) => Promise<CmsVersionDiffEntry[]>;
  onRestore: (versionNumber: number) => void | Promise<void>;
}) {
  const [selected, setSelected] = React.useState<[number, number] | null>(null);
  const [diff, setDiff] = React.useState<CmsVersionDiffEntry[] | null>(null);

  if (versions.length === 0) {
    return <p className="text-sm text-neutral-500">No version history yet.</p>;
  }

  async function compare(from: number, to: number) {
    setSelected([from, to]);
    setDiff(await onCompare(from, to));
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-neutral-100 rounded border border-neutral-200">
        {versions.map((v, i) => {
          const prior = versions[i + 1];
          return (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-800">v{v.versionNumber}</span>{" "}
                <span className="text-neutral-500">
                  {v.changeNote ?? "—"} · {v.createdByEmail} ·{" "}
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {prior ? (
                  <button
                    type="button"
                    className="text-primary-600 hover:underline"
                    onClick={() => void compare(prior.versionNumber, v.versionNumber)}
                  >
                    Compare to v{prior.versionNumber}
                  </button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void onRestore(v.versionNumber)}>
                  Restore
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {diff && selected ? (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-800">
            v{selected[0]} → v{selected[1]}
          </p>
          {diff.length === 0 ? (
            <p className="mt-1 text-neutral-500">No field differences.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {diff.map((entry) => (
                <li key={entry.field}>
                  <span className="font-medium text-neutral-700">{entry.field}</span>:{" "}
                  <span className="text-error-600 line-through">{String(entry.before ?? "—")}</span>{" "}
                  <span className="text-success-600">{String(entry.after ?? "—")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
