import type { AdminAttemptSummary } from "./quiz";
import type { SubmissionHistoryItem } from "./assignment";
import type { LearningDashboard } from "./learning";
import type { UserProfile } from "./user";

export const MENTOR_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
export type MentorTaskStatus = (typeof MENTOR_TASK_STATUSES)[number];

// ---------------------------------------------------------------------------
// Mentor management (admin)
// ---------------------------------------------------------------------------

export interface MentorProfile {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  specialization: string | null;
  maxStudents: number;
  activeStudentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MentorWorkload {
  mentorId: string;
  mentorEmail: string;
  activeStudentCount: number;
  maxStudents: number;
}

export interface AssignedStudentSummary {
  studentId: string;
  studentEmail: string;
  firstName: string | null;
  lastName: string | null;
  assignedAt: string;
}

/** A row in the mentor↔student assignment history (ADR-0016 — never edited, only superseded). */
export interface MentorAssignment {
  id: string;
  studentId: string;
  studentEmail: string;
  mentorId: string;
  mentorEmail: string;
  assignedById: string;
  assignedAt: string;
  unassignedAt: string | null;
}

// ---------------------------------------------------------------------------
// Mentor workflow
// ---------------------------------------------------------------------------

export interface MentorNote {
  id: string;
  studentId: string;
  mentorId: string;
  mentorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentorTask {
  id: string;
  studentId: string;
  mentorId: string;
  mentorEmail: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: MentorTaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MentorFeedback {
  id: string;
  studentId: string;
  mentorId: string;
  mentorEmail: string;
  body: string;
  createdAt: string;
}

export interface MentorMeeting {
  id: string;
  studentId: string;
  mentorId: string;
  mentorEmail: string;
  occurredAt: string;
  durationMinutes: number | null;
  summary: string | null;
  createdAt: string;
}

/** The mentor's own dashboard: caseload, workload, and near-term work (ADR-0016). */
export interface MentorDashboard {
  profile: MentorProfile;
  assignedStudents: AssignedStudentSummary[];
  pendingTaskCount: number;
  upcomingTasks: MentorTask[];
  recentMeetings: MentorMeeting[];
}

// ---------------------------------------------------------------------------
// Student 360
// ---------------------------------------------------------------------------

export const ACTIVITY_TIMELINE_EVENT_TYPES = [
  "LESSON_COMPLETED",
  "QUIZ_ATTEMPT",
  "ASSIGNMENT_SUBMITTED",
  "MENTOR_NOTE",
  "MENTOR_TASK",
  "MENTOR_FEEDBACK",
  "MENTOR_MEETING",
] as const;
export type ActivityTimelineEventType = (typeof ACTIVITY_TIMELINE_EVENT_TYPES)[number];

export interface ActivityTimelineItem {
  type: ActivityTimelineEventType;
  occurredAt: string;
  title: string;
  description: string | null;
}

/**
 * Aggregated read view over Learning/Assessment/Assignment/Mentoring data for
 * one student (ADR-0016) — composed from existing services, not a new data
 * model. `quizHistory`/`assignmentHistory` reuse the exact same admin/student
 * history shapes those domains already expose.
 */
export interface Student360 {
  profile: UserProfile;
  currentMentor: { id: string; email: string } | null;
  learningProgress: LearningDashboard;
  quizHistory: AdminAttemptSummary[];
  assignmentHistory: SubmissionHistoryItem[];
  activityTimeline: ActivityTimelineItem[];
}
