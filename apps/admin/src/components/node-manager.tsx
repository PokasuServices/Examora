"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus } from "@examora/types";
import { Button, Input } from "@examora/ui";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { useContentApi } from "@/lib/content-api";

/** Minimal shape every nested content node shares. */
export interface ContentNode {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  position: number;
}

/**
 * Generic manager for one nested content collection (subjects/topics/modules/
 * lessons): lists nodes under a parent, creates by title, changes status, and
 * deletes. `renderChildren` lets a node expand into the next level down,
 * composing the full hierarchy without duplicating CRUD logic per level.
 */
export function NodeManager({
  collection,
  parentKey,
  parentId,
  label,
  renderChildren,
}: {
  collection: string;
  parentKey: string;
  parentId: string;
  label: string;
  renderChildren?: (node: ContentNode) => React.ReactNode;
}) {
  const api = useContentApi();
  const [nodes, setNodes] = React.useState<ContentNode[]>([]);
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const load = React.useCallback(() => {
    api
      .listNodes<ContentNode>(collection, parentKey, parentId)
      .then((res) => setNodes(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, parentKey, parentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createNode(collection, { [parentKey]: parentId, title });
      setTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not create ${label}`);
    }
  }

  async function changeStatus(id: string, status: ContentStatus): Promise<void> {
    setError(null);
    try {
      await api.setNodeStatus(collection, id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed");
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await api.deleteNode(collection, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={create} className="flex items-center gap-2">
        <Input
          value={title}
          placeholder={`New ${label} title`}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Button type="submit" variant="secondary">
          Add {label}
        </Button>
      </form>
      {error ? <p className="text-sm text-error-600">{error}</p> : null}

      <ul className="flex flex-col gap-2">
        {nodes.map((node) => (
          <li key={node.id} className="rounded-md border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {renderChildren ? (
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-neutral-700"
                    onClick={() => setExpanded((e) => ({ ...e, [node.id]: !e[node.id] }))}
                    aria-label="Toggle children"
                  >
                    {expanded[node.id] ? "▾" : "▸"}
                  </button>
                ) : null}
                <span className="font-medium">{node.title}</span>
                <StatusBadge status={node.status} />
              </div>
              <div className="flex items-center gap-1">
                <StatusActions
                  status={node.status}
                  onChange={(s) => void changeStatus(node.id, s)}
                />
                <Button variant="ghost" onClick={() => void remove(node.id)}>
                  Delete
                </Button>
              </div>
            </div>
            {renderChildren && expanded[node.id] ? (
              <div className="mt-3 border-l-2 border-neutral-100 pl-4">{renderChildren(node)}</div>
            ) : null}
          </li>
        ))}
        {nodes.length === 0 ? <li className="text-sm text-neutral-500">No {label}s yet.</li> : null}
      </ul>
    </div>
  );
}
