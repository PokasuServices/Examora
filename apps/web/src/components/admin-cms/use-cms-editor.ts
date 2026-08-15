"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { CmsContentVersionDto, CmsVersionDiffEntry, CmsWorkflowStatus } from "@examora/types";

type Status = "loading" | "ready" | "not-found" | "error";
type MutationStatus = "idle" | "submitting" | "error";

interface CmsSubClient<T> {
  get: (id: string) => Promise<T>;
  update: (id: string, input: Record<string, unknown>) => Promise<T>;
  transition: (id: string, targetStatus: CmsWorkflowStatus) => Promise<T>;
  schedulePublish: (id: string, at: string) => Promise<T>;
  scheduleUnpublish: (id: string, at: string) => Promise<T>;
  listVersions: (id: string) => Promise<CmsContentVersionDto[]>;
  compareVersions: (id: string, from: number, to: number) => Promise<CmsVersionDiffEntry[]>;
  restoreVersion: (id: string, versionNumber: number) => Promise<T>;
}

/** Generic get/update/transition/schedule/version-history logic — identical across Pages/FAQ/Announcements/Banners, only the sub-client differs. */
export function useCmsEditor<T extends { id: string; status: CmsWorkflowStatus }>(
  id: string,
  api: CmsSubClient<T>,
) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [content, setContent] = React.useState<T | null>(null);
  const [versions, setVersions] = React.useState<CmsContentVersionDto[]>([]);
  const [versionsStatus, setVersionsStatus] = React.useState<Status>("loading");

  const [mutationStatus, setMutationStatus] = React.useState<MutationStatus>("idle");
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .get(id)
      .then((res) => {
        setContent(res);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });

    setVersionsStatus("loading");
    api
      .listVersions(id)
      .then((res) => {
        setVersions(res);
        setVersionsStatus("ready");
      })
      .catch(() => setVersionsStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function save(input: Record<string, unknown>): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.update(id, input);
      setContent(updated);
      setMutationStatus("idle");
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not save changes.");
      return false;
    }
  }

  async function transition(target: CmsWorkflowStatus): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.transition(id, target);
      setContent(updated);
      setMutationStatus("idle");
      load();
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not change status.");
      return false;
    }
  }

  async function schedulePublish(at: string): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.schedulePublish(id, at);
      setContent(updated);
      setMutationStatus("idle");
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not schedule publish.");
      return false;
    }
  }

  async function scheduleUnpublish(at: string): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.scheduleUnpublish(id, at);
      setContent(updated);
      setMutationStatus("idle");
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not schedule unpublish.");
      return false;
    }
  }

  async function restoreVersion(versionNumber: number): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.restoreVersion(id, versionNumber);
      setContent(updated);
      setMutationStatus("idle");
      load();
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not restore this version.");
      return false;
    }
  }

  async function compareVersions(from: number, to: number): Promise<CmsVersionDiffEntry[] | null> {
    try {
      return await api.compareVersions(id, from, to);
    } catch {
      return null;
    }
  }

  return {
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
    retry: load,
  };
}
