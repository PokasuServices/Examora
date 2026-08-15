"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ListTree } from "lucide-react";
import type { Category, Lesson, Module, Subject, Topic } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltersSheet } from "@/components/courses/filters-sheet";
import { useContentApi } from "@/lib/content-api";
import { CourseTree } from "@/components/admin-content/course-tree";
import { CourseDetailPanel } from "@/components/admin-content/course-detail-panel";
import { NodeEditPanel, NodeCreatePanel } from "@/components/admin-content/node-edit-panel";
import { LessonEditPanel } from "@/components/admin-content/lesson-edit-panel";
import { useCourseEditor } from "@/components/admin-content/use-course-editor";

function CourseEditorContent({ courseId }: { courseId: string }) {
  const contentApi = useContentApi();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [treeSheetOpen, setTreeSheetOpen] = React.useState(false);

  React.useEffect(() => {
    contentApi
      .listCategories({ pageSize: 100 })
      .then((res) => setCategories(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
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
    retry,
  } = useCourseEditor(courseId);

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (status === "not-found" || !course) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">Course not found</h1>
        <Link
          href="/admin/content/courses"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          ← Back to courses
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this course" onRetry={retry} />
        </Card>
      </div>
    );
  }

  // Resolve the sibling list + index for whichever node is currently selected, so
  // the detail panel can offer accurate Move up/down.
  let siblings: { id: string }[] = [];
  let selectedNode: Subject | Topic | Module | Lesson | null = null;
  let parentIdOfSelected = "";
  if (selection.kind === "node") {
    if (selection.collection === "subjects") {
      siblings = subjects;
      selectedNode = subjects.find((s) => s.id === selection.id) ?? null;
      parentIdOfSelected = courseId;
    } else if (selection.collection === "topics") {
      const parentSubject = subjects.find((s) =>
        (topicsBySubject[s.id] ?? []).some((t) => t.id === selection.id),
      );
      parentIdOfSelected = parentSubject?.id ?? "";
      siblings = topicsBySubject[parentIdOfSelected] ?? [];
      selectedNode = (siblings.find((t) => t.id === selection.id) as Topic | undefined) ?? null;
    } else if (selection.collection === "modules") {
      const topicId = Object.keys(modulesByTopic).find((tid) =>
        (modulesByTopic[tid] ?? []).some((m) => m.id === selection.id),
      );
      parentIdOfSelected = topicId ?? "";
      siblings = modulesByTopic[parentIdOfSelected] ?? [];
      selectedNode = (siblings.find((m) => m.id === selection.id) as Module | undefined) ?? null;
    } else {
      const moduleId = Object.keys(lessonsByModule).find((mid) =>
        (lessonsByModule[mid] ?? []).some((l) => l.id === selection.id),
      );
      parentIdOfSelected = moduleId ?? "";
      siblings = lessonsByModule[parentIdOfSelected] ?? [];
      selectedNode = (siblings.find((l) => l.id === selection.id) as Lesson | undefined) ?? null;
    }
  }
  const siblingIndex = selectedNode ? siblings.findIndex((s) => s.id === selectedNode!.id) : -1;

  const treeElement = (
    <CourseTree
      courseId={courseId}
      courseTitle={course.title}
      subjects={subjects}
      topicsBySubject={topicsBySubject}
      modulesByTopic={modulesByTopic}
      lessonsByModule={lessonsByModule}
      expanded={expanded}
      loadingChildrenOf={loadingChildrenOf}
      selection={selection}
      onSelect={(sel) => {
        setSelection(sel);
        setTreeSheetOpen(false);
      }}
      onToggle={(id, collection, parentField) => void toggleExpand(id, collection, parentField)}
    />
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/admin/content/courses"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Courses
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          {course.title}
        </h1>
      </div>

      <button
        type="button"
        onClick={() => setTreeSheetOpen(true)}
        className="flex h-10 items-center gap-2 self-start rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
      >
        <ListTree size={16} strokeWidth={1.75} aria-hidden="true" />
        Course structure
      </button>
      <FiltersSheet
        open={treeSheetOpen}
        onClose={() => setTreeSheetOpen(false)}
        title="Course structure"
        footerLabel="Close"
      >
        {treeElement}
      </FiltersSheet>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card density="compact" className="hidden min-w-0 lg:block lg:w-72 lg:shrink-0">
          <div className="max-h-[70vh] overflow-y-auto p-2">{treeElement}</div>
        </Card>

        <Card className="min-w-0 flex-1">
          {selection.kind === "course" ? (
            <CourseDetailPanel
              course={course}
              categories={categories}
              mutationStatus={mutationStatus}
              mutationError={mutationError}
              onSave={updateCourse}
              onStatusChange={setCourseStatus}
            />
          ) : selection.kind === "new" ? (
            <NodeCreatePanel
              collection={selection.collection}
              mutationStatus={mutationStatus}
              mutationError={mutationError}
              onCreate={(body) => void createChild(selection.collection, selection.parentId, body)}
              onCancel={() => setSelection({ kind: "course" })}
            />
          ) : selectedNode ? (
            selection.collection === "lessons" ? (
              <LessonEditPanel
                lesson={selectedNode as Lesson}
                siblingIndex={siblingIndex}
                siblingCount={siblings.length}
                mutationStatus={mutationStatus}
                mutationError={mutationError}
                onSave={(body) => updateNode("lessons", selection.id, parentIdOfSelected, body)}
                onStatusChange={(s) =>
                  setNodeStatus("lessons", selection.id, parentIdOfSelected, s)
                }
                onDelete={() => deleteNode("lessons", selection.id, parentIdOfSelected)}
                onMove={(dir) =>
                  void moveNode("lessons", siblings, selection.id, dir, parentIdOfSelected)
                }
              />
            ) : (
              <NodeEditPanel
                collection={selection.collection as "subjects" | "topics" | "modules"}
                node={selectedNode as Subject | Topic | Module}
                siblingIndex={siblingIndex}
                siblingCount={siblings.length}
                mutationStatus={mutationStatus}
                mutationError={mutationError}
                onSave={(body) =>
                  updateNode(selection.collection, selection.id, parentIdOfSelected, body)
                }
                onStatusChange={(s) =>
                  setNodeStatus(selection.collection, selection.id, parentIdOfSelected, s)
                }
                onDelete={() => deleteNode(selection.collection, selection.id, parentIdOfSelected)}
                onMove={(dir) =>
                  void moveNode(
                    selection.collection,
                    siblings,
                    selection.id,
                    dir,
                    parentIdOfSelected,
                  )
                }
              />
            )
          ) : (
            <p className="text-sm text-neutral-500">
              This item could not be found — it may have just been deleted.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="content:manage">
      <CourseEditorContent courseId={id} />
    </RequirePermission>
  );
}
