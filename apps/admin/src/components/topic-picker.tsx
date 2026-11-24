"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import type { Course, Subject, Topic } from "@examora/types";
import { SelectField } from "@/components/ui/select-field";
import { useContentApi } from "@/lib/content-api";

/**
 * Course → subject → topic chooser for a question. The topic drives the
 * topic-level analysis in student reports; the subject drives subject scores.
 */
export function TopicPicker({
  subjectId,
  topicId,
  onChange,
}: {
  subjectId: string | null;
  topicId: string | null;
  onChange: (value: { subjectId: string | null; topicId: string | null }) => void;
}) {
  const content = useContentApi();
  const { request } = useAuth();
  const refs = React.useRef({ content, request });
  refs.current = { content, request };
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [courseId, setCourseId] = React.useState("");
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [topics, setTopics] = React.useState<Topic[]>([]);

  // Courses, plus the course of the question's current subject.
  React.useEffect(() => {
    refs.current.content
      .listCourses()
      .then((res) => setCourses(res.items))
      .catch(() => setCourses([]));
    if (subjectId) {
      refs.current
        .request<Subject>(`/admin/content/subjects/${subjectId}`, { method: "GET" })
        .then((s) => setCourseId(s.courseId))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!courseId) {
      setSubjects([]);
      return;
    }
    refs.current.content
      .listNodes<Subject>("subjects", "courseId", courseId)
      .then((res) => setSubjects(res.items))
      .catch(() => setSubjects([]));
  }, [courseId]);

  React.useEffect(() => {
    if (!subjectId) {
      setTopics([]);
      return;
    }
    refs.current.content
      .listNodes<Topic>("topics", "subjectId", subjectId)
      .then((res) => setTopics(res.items))
      .catch(() => setTopics([]));
  }, [subjectId]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField
        id="q-course"
        label="Course"
        value={courseId}
        options={[
          { value: "", label: "— choose —" },
          ...courses.map((c) => ({ value: c.id, label: c.title })),
        ]}
        onChange={(v) => {
          setCourseId(v);
          onChange({ subjectId: null, topicId: null });
        }}
      />
      <SelectField
        id="q-subject"
        label="Subject"
        value={subjectId ?? ""}
        options={[
          { value: "", label: courseId ? "— choose —" : "Choose a course" },
          ...subjects.map((s) => ({ value: s.id, label: s.title })),
        ]}
        onChange={(v) => onChange({ subjectId: v || null, topicId: null })}
      />
      <SelectField
        id="q-topic"
        label="Topic (for report analysis)"
        value={topicId ?? ""}
        options={[
          { value: "", label: subjectId ? "— none —" : "Choose a subject" },
          ...topics.map((t) => ({ value: t.id, label: t.title })),
        ]}
        onChange={(v) => onChange({ subjectId, topicId: v || null })}
      />
    </div>
  );
}
