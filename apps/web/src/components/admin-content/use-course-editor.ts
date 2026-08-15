"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Course, Lesson, Module, Subject, Topic } from "@examora/types";
import { useContentApi } from "@/lib/content-api";

type Status = "loading" | "ready" | "not-found" | "error";
type MutationStatus = "idle" | "submitting" | "error";

export type NodeCollection = "subjects" | "topics" | "modules" | "lessons";

export type Selection =
  | { kind: "course" }
  | { kind: "node"; collection: NodeCollection; id: string }
  | { kind: "new"; collection: NodeCollection; parentId: string };

/**
 * Owns the whole Course → Subjects → Topics → Modules → Lessons tree.
 * Subjects load eagerly (always the first visible level); Topics/Modules/
 * Lessons load lazily the first time their parent is expanded — the same
 * expand-on-demand pattern as a file-explorer tree, not a full eager fetch
 * of the entire hierarchy up front.
 */
export function useCourseEditor(courseId: string) {
  const api = useContentApi();

  const [status, setStatus] = React.useState<Status>("loading");
  const [course, setCourse] = React.useState<Course | null>(null);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [topicsBySubject, setTopicsBySubject] = React.useState<Record<string, Topic[]>>({});
  const [modulesByTopic, setModulesByTopic] = React.useState<Record<string, Module[]>>({});
  const [lessonsByModule, setLessonsByModule] = React.useState<Record<string, Lesson[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [loadingChildrenOf, setLoadingChildrenOf] = React.useState<Set<string>>(new Set());

  const [selection, setSelection] = React.useState<Selection>({ kind: "course" });
  const [mutationStatus, setMutationStatus] = React.useState<MutationStatus>("idle");
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([api.getCourse(courseId), api.listNodes<Subject>("subjects", "courseId", courseId)])
      .then(([courseRes, subjectsRes]) => {
        setCourse(courseRes);
        setSubjects([...subjectsRes.items].sort((a, b) => a.position - b.position));
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function toggleExpand(
    id: string,
    collection: NodeCollection,
    parentField: string,
  ): Promise<void> {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    const alreadyLoaded =
      collection === "topics"
        ? topicsBySubject[id] !== undefined
        : collection === "modules"
          ? modulesByTopic[id] !== undefined
          : lessonsByModule[id] !== undefined;
    if (alreadyLoaded) return;

    setLoadingChildrenOf((prev) => new Set(prev).add(id));
    try {
      const res = await api.listNodes<Topic | Module | Lesson>(collection, parentField, id);
      const sorted = [...res.items].sort((a, b) => a.position - b.position);
      if (collection === "topics")
        setTopicsBySubject((prev) => ({ ...prev, [id]: sorted as Topic[] }));
      else if (collection === "modules")
        setModulesByTopic((prev) => ({ ...prev, [id]: sorted as Module[] }));
      else setLessonsByModule((prev) => ({ ...prev, [id]: sorted as Lesson[] }));
    } finally {
      setLoadingChildrenOf((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function refreshChildren(
    collection: NodeCollection,
    parentId: string,
    parentField: string,
  ): void {
    api
      .listNodes<Topic | Module | Lesson>(collection, parentField, parentId)
      .then((res) => {
        const sorted = [...res.items].sort((a, b) => a.position - b.position);
        if (collection === "topics")
          setTopicsBySubject((prev) => ({ ...prev, [parentId]: sorted as Topic[] }));
        else if (collection === "modules")
          setModulesByTopic((prev) => ({ ...prev, [parentId]: sorted as Module[] }));
        else setLessonsByModule((prev) => ({ ...prev, [parentId]: sorted as Lesson[] }));
      })
      .catch(() => undefined);
  }

  function refreshSubjects(): void {
    api
      .listNodes<Subject>("subjects", "courseId", courseId)
      .then((res) => setSubjects([...res.items].sort((a, b) => a.position - b.position)))
      .catch(() => undefined);
  }

  const PARENT_FIELD: Record<NodeCollection, string> = {
    subjects: "courseId",
    topics: "subjectId",
    modules: "topicId",
    lessons: "moduleId",
  };

  async function updateCourse(input: Record<string, unknown>): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const updated = await api.updateCourse(courseId, input);
      setCourse(updated);
      setMutationStatus("idle");
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not update the course.");
      return false;
    }
  }

  async function setCourseStatus(newStatus: ContentStatus): Promise<boolean> {
    try {
      const updated = await api.setCourseStatus(courseId, newStatus);
      setCourse(updated);
      return true;
    } catch {
      return false;
    }
  }

  async function createChild(
    collection: NodeCollection,
    parentId: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.createNode(collection, { ...body, [PARENT_FIELD[collection]]: parentId });
      setMutationStatus("idle");
      if (collection === "subjects") refreshSubjects();
      else refreshChildren(collection, parentId, PARENT_FIELD[collection]);
      setExpanded((prev) => new Set(prev).add(parentId));
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not create this item.");
      return false;
    }
  }

  async function updateNode(
    collection: NodeCollection,
    id: string,
    parentId: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.updateNode(collection, id, body);
      setMutationStatus("idle");
      if (collection === "subjects") refreshSubjects();
      else refreshChildren(collection, parentId, PARENT_FIELD[collection]);
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not save changes.");
      return false;
    }
  }

  async function setNodeStatus(
    collection: NodeCollection,
    id: string,
    parentId: string,
    newStatus: ContentStatus,
  ): Promise<boolean> {
    try {
      await api.setNodeStatus(collection, id, newStatus);
      if (collection === "subjects") refreshSubjects();
      else refreshChildren(collection, parentId, PARENT_FIELD[collection]);
      return true;
    } catch {
      return false;
    }
  }

  async function deleteNode(
    collection: NodeCollection,
    id: string,
    parentId: string,
  ): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.deleteNode(collection, id);
      setMutationStatus("idle");
      if (collection === "subjects") refreshSubjects();
      else refreshChildren(collection, parentId, PARENT_FIELD[collection]);
      if (selection.kind === "node" && selection.id === id) setSelection({ kind: "course" });
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not delete this item.");
      return false;
    }
  }

  async function moveNode(
    collection: NodeCollection,
    siblings: { id: string }[],
    id: string,
    direction: "up" | "down",
    parentId: string,
  ): Promise<void> {
    const index = siblings.findIndex((s) => s.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
    await api.reorderNodes(
      collection,
      reordered.map((s) => s.id),
    );
    if (collection === "subjects") refreshSubjects();
    else refreshChildren(collection, parentId, PARENT_FIELD[collection]);
  }

  return {
    status,
    course,
    subjects,
    topicsBySubject,
    modulesByTopic,
    lessonsByModule,
    expanded,
    loadingChildrenOf,
    toggleExpand,
    selection,
    setSelection,
    mutationStatus,
    mutationError,
    updateCourse,
    setCourseStatus,
    createChild,
    updateNode,
    setNodeStatus,
    deleteNode,
    moveNode,
    retry: load,
  };
}
