"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { ContentStatus, Course } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { NodeManager, type ContentNode } from "@/components/node-manager";
import { RequirePermission } from "@/components/require-permission";
import { StatusActions } from "@/components/status-actions";
import { StatusBadge } from "@/components/status-badge";
import { useContentApi } from "@/lib/content-api";

function CourseDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useContentApi();
  const [course, setCourse] = React.useState<Course | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priceAmount, setPriceAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .getCourse(id)
      .then((c) => {
        setCourse(c);
        setTitle(c.title);
        setDescription(c.description ?? "");
        setPriceAmount(c.priceAmount === null ? "" : String(c.priceAmount));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveDetails(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateCourse(id, {
        title,
        description,
        isFree: priceAmount === "",
        priceAmount: priceAmount === "" ? undefined : Number(priceAmount),
      });
      setCourse(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function changeStatus(status: ContentStatus): Promise<void> {
    setError(null);
    try {
      setCourse(await api.setCourseStatus(id, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status change failed");
    }
  }

  if (!course) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
        <FieldError>{error}</FieldError>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/content/courses" className="hover:underline">
          Courses
        </Link>{" "}
        · <span className="text-neutral-800">{course.title}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-heading">{course.title}</h1>
          <StatusBadge status={course.status} />
        </div>
        <StatusActions status={course.status} onChange={(s) => void changeStatus(s)} />
      </div>

      <form
        onSubmit={saveDetails}
        className="mt-6 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h2 className="text-lg font-semibold">Course details</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className="min-h-24 rounded-md border border-neutral-300 p-3 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceAmount">Price (INR, blank = free — ADR-0018)</Label>
          <Input
            id="priceAmount"
            type="number"
            min="0"
            step="0.01"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            className="w-40"
          />
        </div>
        <FieldError>{error}</FieldError>
        {saved ? <p className="text-sm text-success-600">Saved.</p> : null}
        <div>
          <Button type="submit">Save details</Button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Curriculum</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Subjects → Topics → Modules → Lessons. Expand a node to manage its children.
        </p>
        <div className="mt-4">
          <NodeManager
            collection="subjects"
            parentKey="courseId"
            parentId={course.id}
            label="subject"
            renderChildren={(subject: ContentNode) => (
              <NodeManager
                collection="topics"
                parentKey="subjectId"
                parentId={subject.id}
                label="topic"
                renderChildren={(topic: ContentNode) => (
                  <NodeManager
                    collection="modules"
                    parentKey="topicId"
                    parentId={topic.id}
                    label="module"
                    renderChildren={(mod: ContentNode) => (
                      <NodeManager
                        collection="lessons"
                        parentKey="moduleId"
                        parentId={mod.id}
                        label="lesson"
                      />
                    )}
                  />
                )}
              />
            )}
          />
        </div>
      </section>
    </main>
  );
}

export default function CourseDetailPage() {
  return (
    <RequirePermission permission="content:manage">
      <CourseDetailContent />
    </RequirePermission>
  );
}
