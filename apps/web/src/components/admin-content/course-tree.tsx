"use client";

import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { Lesson, Module, Subject, Topic } from "@examora/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@examora/ui";
import type { NodeCollection, Selection } from "./use-course-editor";

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-neutral-300",
  PUBLISHED: "bg-success-500",
  ARCHIVED: "bg-warning-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[status] ?? "bg-neutral-300")}
      aria-hidden="true"
    />
  );
}

function TreeRow({
  label,
  status,
  depth,
  selected,
  expandable,
  expanded,
  onSelect,
  onToggle,
  onAddChild,
  addLabel,
}: {
  label: string;
  status?: string;
  depth: number;
  selected: boolean;
  expandable: boolean;
  expanded?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  onAddChild?: () => void;
  addLabel?: string;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm",
        selected ? "bg-primary-50 text-primary-700" : "text-neutral-700 hover:bg-neutral-100",
      )}
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-700"
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn("transition-transform", expanded && "rotate-90")}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        {status ? <StatusDot status={status} /> : null}
        <span className="truncate">{label}</span>
      </button>
      {onAddChild ? (
        <button
          type="button"
          onClick={onAddChild}
          aria-label={addLabel}
          title={addLabel}
          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 group-hover:flex"
        >
          <Plus size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function CourseTree({
  courseId,
  courseTitle,
  subjects,
  topicsBySubject,
  modulesByTopic,
  lessonsByModule,
  expanded,
  loadingChildrenOf,
  selection,
  onSelect,
  onToggle,
}: {
  courseId: string;
  courseTitle: string;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  modulesByTopic: Record<string, Module[]>;
  lessonsByModule: Record<string, Lesson[]>;
  expanded: Set<string>;
  loadingChildrenOf: Set<string>;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onToggle: (id: string, collection: NodeCollection, parentField: string) => void;
}) {
  function isSelected(collection: NodeCollection, id: string): boolean {
    return selection.kind === "node" && selection.collection === collection && selection.id === id;
  }
  function isNewSelected(collection: NodeCollection, parentId: string): boolean {
    return (
      selection.kind === "new" &&
      selection.collection === collection &&
      selection.parentId === parentId
    );
  }

  return (
    <nav aria-label="Course structure" className="flex flex-col gap-0.5">
      <TreeRow
        label={courseTitle}
        depth={0}
        selected={selection.kind === "course" || isNewSelected("subjects", courseId)}
        expandable={false}
        onSelect={() => onSelect({ kind: "course" })}
        onAddChild={() => onSelect({ kind: "new", collection: "subjects", parentId: courseId })}
        addLabel="Add subject"
      />

      {subjects.map((subject) => (
        <React.Fragment key={subject.id}>
          <TreeRow
            label={subject.title}
            status={subject.status}
            depth={1}
            selected={isSelected("subjects", subject.id) || isNewSelected("topics", subject.id)}
            expandable
            expanded={expanded.has(subject.id)}
            onSelect={() => onSelect({ kind: "node", collection: "subjects", id: subject.id })}
            onToggle={() => onToggle(subject.id, "topics", "subjectId")}
            onAddChild={() => onSelect({ kind: "new", collection: "topics", parentId: subject.id })}
            addLabel={`Add topic to ${subject.title}`}
          />
          {expanded.has(subject.id) ? (
            loadingChildrenOf.has(subject.id) ? (
              <div style={{ paddingLeft: 40 }}>
                <Skeleton className="my-1 h-6 w-40" />
              </div>
            ) : (
              (topicsBySubject[subject.id] ?? []).map((topic) => (
                <React.Fragment key={topic.id}>
                  <TreeRow
                    label={topic.title}
                    status={topic.status}
                    depth={2}
                    selected={isSelected("topics", topic.id) || isNewSelected("modules", topic.id)}
                    expandable
                    expanded={expanded.has(topic.id)}
                    onSelect={() => onSelect({ kind: "node", collection: "topics", id: topic.id })}
                    onToggle={() => onToggle(topic.id, "modules", "topicId")}
                    onAddChild={() =>
                      onSelect({ kind: "new", collection: "modules", parentId: topic.id })
                    }
                    addLabel={`Add module to ${topic.title}`}
                  />
                  {expanded.has(topic.id) ? (
                    loadingChildrenOf.has(topic.id) ? (
                      <div style={{ paddingLeft: 56 }}>
                        <Skeleton className="my-1 h-6 w-40" />
                      </div>
                    ) : (
                      (modulesByTopic[topic.id] ?? []).map((mod) => (
                        <React.Fragment key={mod.id}>
                          <TreeRow
                            label={mod.title}
                            status={mod.status}
                            depth={3}
                            selected={
                              isSelected("modules", mod.id) || isNewSelected("lessons", mod.id)
                            }
                            expandable
                            expanded={expanded.has(mod.id)}
                            onSelect={() =>
                              onSelect({ kind: "node", collection: "modules", id: mod.id })
                            }
                            onToggle={() => onToggle(mod.id, "lessons", "moduleId")}
                            onAddChild={() =>
                              onSelect({ kind: "new", collection: "lessons", parentId: mod.id })
                            }
                            addLabel={`Add lesson to ${mod.title}`}
                          />
                          {expanded.has(mod.id) ? (
                            loadingChildrenOf.has(mod.id) ? (
                              <div style={{ paddingLeft: 72 }}>
                                <Skeleton className="my-1 h-6 w-40" />
                              </div>
                            ) : (
                              (lessonsByModule[mod.id] ?? []).map((lesson) => (
                                <TreeRow
                                  key={lesson.id}
                                  label={lesson.title}
                                  status={lesson.status}
                                  depth={4}
                                  selected={isSelected("lessons", lesson.id)}
                                  expandable={false}
                                  onSelect={() =>
                                    onSelect({ kind: "node", collection: "lessons", id: lesson.id })
                                  }
                                />
                              ))
                            )
                          ) : null}
                        </React.Fragment>
                      ))
                    )
                  ) : null}
                </React.Fragment>
              ))
            )
          ) : null}
        </React.Fragment>
      ))}
    </nav>
  );
}
