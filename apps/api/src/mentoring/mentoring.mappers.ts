import type {
  AssignedStudentSummary,
  MentorAssignment as MentorAssignmentDto,
  MentorFeedback as MentorFeedbackDto,
  MentorMeeting as MentorMeetingDto,
  MentorNote as MentorNoteDto,
  MentorProfile as MentorProfileDto,
  MentorTask as MentorTaskDto,
} from "@examora/types";
import type {
  MentorAssignment,
  MentorFeedback,
  MentorMeeting,
  MentorNote,
  MentorProfile,
  MentorTask,
} from "@examora/database";

type WithStudentEmail = { student: { email: string } };
type WithMentorEmail = { mentor: { email: string } };

export function toMentorProfile(
  row: MentorProfile & {
    user: { email: string; firstName: string | null; lastName: string | null };
  },
  activeStudentCount: number,
): MentorProfileDto {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    bio: row.bio,
    specialization: row.specialization,
    maxStudents: row.maxStudents,
    activeStudentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMentorAssignment(
  row: MentorAssignment & WithStudentEmail & WithMentorEmail,
): MentorAssignmentDto {
  return {
    id: row.id,
    studentId: row.studentId,
    studentEmail: row.student.email,
    mentorId: row.mentorId,
    mentorEmail: row.mentor.email,
    assignedById: row.assignedById,
    assignedAt: row.assignedAt.toISOString(),
    unassignedAt: row.unassignedAt ? row.unassignedAt.toISOString() : null,
  };
}

export function toAssignedStudentSummary(
  row: MentorAssignment & {
    student: { email: string; firstName: string | null; lastName: string | null };
  },
): AssignedStudentSummary {
  return {
    studentId: row.studentId,
    studentEmail: row.student.email,
    firstName: row.student.firstName,
    lastName: row.student.lastName,
    assignedAt: row.assignedAt.toISOString(),
  };
}

export function toMentorNote(row: MentorNote & WithMentorEmail): MentorNoteDto {
  return {
    id: row.id,
    studentId: row.studentId,
    mentorId: row.mentorId,
    mentorEmail: row.mentor.email,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMentorTask(row: MentorTask & WithMentorEmail): MentorTaskDto {
  return {
    id: row.id,
    studentId: row.studentId,
    mentorId: row.mentorId,
    mentorEmail: row.mentor.email,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toMentorFeedback(row: MentorFeedback & WithMentorEmail): MentorFeedbackDto {
  return {
    id: row.id,
    studentId: row.studentId,
    mentorId: row.mentorId,
    mentorEmail: row.mentor.email,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMentorMeeting(row: MentorMeeting & WithMentorEmail): MentorMeetingDto {
  return {
    id: row.id,
    studentId: row.studentId,
    mentorId: row.mentorId,
    mentorEmail: row.mentor.email,
    occurredAt: row.occurredAt.toISOString(),
    durationMinutes: row.durationMinutes,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
  };
}
