"use client";

import { useParams } from "next/navigation";
import { Users } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { EmptyState } from "@/components/ui/empty-state";
import { useStudent360 } from "@/components/mentor/use-student-360";
import { StudentHero } from "@/components/mentor/student-hero";
import { OverallProgressSection } from "@/components/mentor/overall-progress-section";
import { LearningProgressSection } from "@/components/mentor/learning-progress-section";
import { QuizHistorySection } from "@/components/mentor/quiz-history-section";
import { AssignmentHistorySection } from "@/components/mentor/assignment-history-section";
import { NotesSection } from "@/components/mentor/notes-section";
import { TasksSection } from "@/components/mentor/tasks-section";
import { MeetingsSection } from "@/components/mentor/meetings-section";
import { FeedbackSection } from "@/components/mentor/feedback-section";
import { ActivityTimelineSection } from "@/components/mentor/activity-timeline-section";
import { Student360Skeleton } from "@/components/mentor/skeletons";

function Student360Content() {
  const { id: studentId } = useParams<{ id: string }>();
  const {
    loadState,
    student360,
    notes,
    tasks,
    feedback,
    meetings,
    createNote,
    updateNote,
    deleteNote,
    createTask,
    updateTaskStatus,
    deleteTask,
    createFeedback,
    createMeeting,
  } = useStudent360(studentId);

  if (loadState === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Users}
          heading="Student not available"
          body="This student isn't assigned to you, or doesn't exist."
          actionLabel="Back to my students"
          actionHref="/mentor/students"
        />
      </main>
    );
  }

  if (loadState === "loading" || !student360) {
    return <Student360Skeleton />;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <StudentHero student360={student360} />
      <OverallProgressSection stats={student360.learningProgress.stats} />
      <LearningProgressSection courses={student360.learningProgress.continueLearning} />
      <QuizHistorySection attempts={student360.quizHistory} />
      <AssignmentHistorySection history={student360.assignmentHistory} />
      <NotesSection
        notes={notes}
        onCreate={createNote}
        onUpdate={updateNote}
        onDelete={deleteNote}
      />
      <TasksSection
        tasks={tasks}
        onCreate={createTask}
        onUpdateStatus={updateTaskStatus}
        onDelete={deleteTask}
      />
      <MeetingsSection meetings={meetings} onCreate={createMeeting} />
      <FeedbackSection feedback={feedback} onCreate={createFeedback} />
      <ActivityTimelineSection items={student360.activityTimeline} />
    </main>
  );
}

export default function Student360Page() {
  return (
    <RequirePermission permission="mentor:workflow">
      <Student360Content />
    </RequirePermission>
  );
}
