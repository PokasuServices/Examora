/**
 * Mentor module ("mentor desk"): what mentors work with day to day in the
 * staff workspace, plus the few student-facing views it feeds (attendance
 * card, shout-out badges, batch announcements).
 */

export interface PersonRef {
  id: string;
  name: string;
  email: string;
}

// ---------------------------------------------------------------- attendance

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

/** Present and late both count as attended. */
export function attendedStatus(s: AttendanceStatus | null | undefined): boolean {
  return s === "PRESENT" || s === "LATE";
}

export interface ClassSessionView {
  id: string;
  cohortId: string;
  cohortName: string;
  courseTitle: string | null;
  /** YYYY-MM-DD (India) */
  date: string;
  start: string;
  end: string;
  mode: "OFFLINE" | "ONLINE";
  topic: string | null;
  cancelled: boolean;
  takenAt: string | null;
  takenBy: string | null;
  counts: Record<AttendanceStatus, number>;
  /** Students in the batch */
  total: number;
}

export interface SessionRoster {
  session: ClassSessionView;
  location: string | null;
  meetingUrl: string | null;
  students: {
    userId: string;
    name: string;
    email: string;
    status: AttendanceStatus | null;
    note: string | null;
    /** Attendance % in this batch over the last 30 days (null = no classes yet) */
    recentPercent: number | null;
  }[];
}

export interface AttendanceMarkInput {
  topic?: string | null;
  records: { userId: string; status: AttendanceStatus; note?: string | null }[];
}

/** Students × classes for a batch and date range. */
export interface AttendanceGrid {
  cohortId: string;
  cohortName: string;
  courseTitle: string | null;
  from: string;
  to: string;
  sessions: {
    id: string;
    date: string;
    start: string;
    end: string;
    cancelled: boolean;
    taken: boolean;
  }[];
  rows: {
    userId: string;
    name: string;
    email: string;
    statuses: (AttendanceStatus | null)[];
    present: number;
    late: number;
    absent: number;
    excused: number;
    /** Attended / classes held (excused classes not counted) */
    percent: number | null;
  }[];
  /** Whole batch, same rule */
  percent: number | null;
}

/** One row per batch for a course/month overview. */
export interface AttendanceOverviewRow {
  cohortId: string;
  cohortName: string;
  courseTitle: string | null;
  mentor: string | null;
  classesHeld: number;
  classesPending: number;
  percent: number | null;
  students: number;
  lowAttendance: number;
}

export type AttendancePeriod = "daily" | "weekly" | "monthly";

/** The student's own attendance card. */
export interface MyAttendanceView {
  percent: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  held: number;
  batches: { id: string; name: string; percent: number | null; nextClass: string | null }[];
  recent: { date: string; start: string; cohortName: string; status: AttendanceStatus | null }[];
}

// ---------------------------------------------------------------- today (home)

export interface AtRiskStudent {
  userId: string;
  name: string;
  email: string;
  cohortName: string;
  reasons: string[];
}

export interface MentorTodayView {
  mentorName: string;
  date: string;
  classes: {
    sessionId: string;
    cohortId: string;
    cohortName: string;
    start: string;
    end: string;
    mode: "OFFLINE" | "ONLINE";
    location: string | null;
    meetingUrl: string | null;
    taken: boolean;
    present: number | null;
    total: number;
  }[];
  /** Classes in the last 7 days whose attendance isn't marked yet */
  unmarked: { sessionId: string; cohortName: string; date: string; start: string }[];
  reviews: { sketches: number; revisions: number; assignments: number; oldestHours: number | null };
  doubts: { open: number; newToday: number };
  quizGaps: { courseId: string; courseTitle: string; emptyDays: string[] }[];
  returned: { reports: number; requests: number };
  atRisk: AtRiskStudent[];
  batches: {
    id: string;
    name: string;
    courseTitle: string | null;
    students: number;
    percent: number | null;
    role: "PRIMARY" | "COVER";
    coverEndsOn: string | null;
  }[];
  shoutoutsLeft: number;
}

// ---------------------------------------------------------------- review inbox

export type ReviewKind = "SKETCH" | "REVISION" | "ASSIGNMENT";

export interface ReviewInboxItem {
  kind: ReviewKind;
  id: string;
  student: PersonRef;
  title: string;
  detail: string | null;
  submittedAt: string | null;
  waitingHours: number | null;
  /** Staff-workspace path to mark it */
  href: string;
}

export interface ReviewInbox {
  items: ReviewInboxItem[];
  counts: Record<ReviewKind, number>;
  /** Marked by me in the last 30 days */
  doneLast30: number;
  avgTurnaroundHours: number | null;
}

// ---------------------------------------------------------------- doubts

export interface MentorDoubtItem {
  id: string;
  questionId: string;
  questionText: string;
  courseTitle: string | null;
  author: PersonRef;
  inMyBatch: boolean;
  body: string;
  createdAt: string;
  replies: number;
  answeredByStaff: boolean;
  resolvedAt: string | null;
}

export interface MentorDoubtThread {
  doubt: MentorDoubtItem;
  questionImageUrl: string | null;
  replies: { id: string; author: PersonRef; isStaff: boolean; body: string; createdAt: string }[];
}

// ---------------------------------------------------------------- daily quiz calendar

export interface DailyScheduleItem {
  id: string;
  courseId: string;
  date: string;
  title: string;
  questionIds: string[];
  createdBy: { id: string; name: string };
  mine: boolean;
  /** Set when the date picked was taken and the quiz moved */
  movedFrom?: string;
}

export interface DailyCalendarView {
  courseId: string;
  courseTitle: string;
  from: string;
  to: string;
  days: { date: string; schedule: DailyScheduleItem | null; played: number }[];
}

export interface DailyScheduleInput {
  courseId: string;
  date: string;
  title: string;
  questionIds: string[];
}

// ---------------------------------------------------------------- duplicates

export interface DuplicateMatch {
  questionId: string;
  text: string;
  /** 0–100 */
  similarity: number;
  where: string;
}

// ---------------------------------------------------------------- reports

export const REPORT_KINDS = ["MONTHLY", "ALERT", "PTM"] as const;
export type ProgressReportKind = (typeof REPORT_KINDS)[number];
export const REPORT_KIND_LABEL: Record<ProgressReportKind, string> = {
  MONTHLY: "Monthly report card",
  ALERT: "Alert",
  PTM: "Parent–teacher meeting notes",
};
export type ProgressReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";

export interface ProgressReportSummary {
  attendancePercent: number | null;
  classesHeld: number;
  absences: number;
  quizzesTaken: number;
  avgQuizPercent: number | null;
  dailyQuizDays: number;
  sketchesMarked: number;
  avgSketchPercent: number | null;
  assignmentsSubmitted: number;
  assignmentsMissing: number;
  lessonsCompleted: number;
  weakTopics: string[];
}

export interface ProgressReportView {
  id: string;
  kind: ProgressReportKind;
  period: string;
  status: ProgressReportStatus;
  student: PersonRef;
  cohort: { id: string; name: string } | null;
  mentor: PersonRef;
  summary: ProgressReportSummary;
  remarks: string;
  adminNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- shout-outs

export const SHOUTOUT_BADGES = [
  { key: "best-sketch", label: "Best sketch this week", icon: "brush" },
  { key: "most-improved", label: "Most improved", icon: "trending-up" },
  { key: "doubt-solver", label: "Helpful doubt solver", icon: "message-circle" },
  { key: "perfect-attendance", label: "Perfect attendance", icon: "calendar-check" },
  { key: "quiz-champion", label: "Quiz champion", icon: "trophy" },
  { key: "creative-thinker", label: "Creative thinker", icon: "lightbulb" },
  { key: "consistent", label: "Consistent effort", icon: "flame" },
] as const;
export type ShoutoutBadge = (typeof SHOUTOUT_BADGES)[number]["key"];
/** Per mentor, per rolling 7 days, so a shout-out stays special. */
export const SHOUTOUTS_PER_WEEK = 5;

export interface ShoutoutView {
  id: string;
  badge: ShoutoutBadge;
  label: string;
  icon: string;
  note: string | null;
  createdAt: string;
  student: PersonRef;
  mentor: { id: string; name: string };
}

// ---------------------------------------------------------------- announcements

export interface BatchAnnouncementView {
  id: string;
  cohortId: string;
  cohortName: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  author: { id: string; name: string };
}

// ---------------------------------------------------------------- staff requests (approvals)

export const STAFF_REQUEST_KINDS = ["CONTENT_PUBLISH", "CONTENT_CHANGE", "NEW_STUDENT"] as const;
export type StaffRequestKind = (typeof STAFF_REQUEST_KINDS)[number];
export const STAFF_REQUEST_LABEL: Record<StaffRequestKind, string> = {
  CONTENT_PUBLISH: "Publish request",
  CONTENT_CHANGE: "Content change",
  NEW_STUDENT: "New student",
};
/** Fixed content a mentor edits through admin review. */
export const REVIEWABLE_CONTENT_TYPES = ["subject", "topic", "module", "lesson", "quiz"] as const;
export type ReviewableContentType = (typeof REVIEWABLE_CONTENT_TYPES)[number];

/** Error code when a mentor's edit was saved as a request instead of applied. */
export const SENT_FOR_REVIEW = "SENT_FOR_REVIEW";

export interface StaffRequestView {
  id: string;
  kind: StaffRequestKind;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: PersonRef;
  decidedBy: { id: string; name: string } | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** CONTENT_CHANGE: field-by-field */
  changes: { field: string; before: string; after: string }[];
  /** NEW_STUDENT: who and where */
  student: {
    name: string;
    email: string;
    phone: string | null;
    cohortName: string | null;
    exists: boolean;
  } | null;
}

// ---------------------------------------------------------------- batch progress & students

export interface BatchProgressView {
  cohortId: string;
  cohortName: string;
  courseTitle: string | null;
  lessonsTotal: number;
  topics: {
    topicId: string;
    title: string;
    subjectTitle: string;
    /** % of students who finished every lesson in it */
    completedPercent: number;
    started: number;
    onHold: number;
  }[];
  students: {
    userId: string;
    name: string;
    email: string;
    lessonsDone: number;
    percent: number;
    attendancePercent: number | null;
    avgQuizPercent: number | null;
    lastActiveAt: string | null;
  }[];
}

// ---------------------------------------------------------------- workload & performance

export interface MentorWorkloadView {
  mentor: PersonRef;
  batches: number;
  students: number;
  classesPerWeek: number;
  attendanceMarked30: number;
  attendancePending: number;
  pendingReviews: number;
  reviewedLast30: number;
  avgTurnaroundHours: number | null;
  doubtsAnswered30: number;
  avgDoubtResponseHours: number | null;
  reportsSubmitted30: number;
  shoutouts30: number;
  quizzesPublished30: number;
}

// ---------------------------------------------------------------- Excel import

export interface ImportRowIssue {
  /** 1-based sheet row */
  row: number;
  message: string;
}

export interface ImportPreview {
  /** Rows that will be saved */
  ok: number;
  issues: ImportRowIssue[];
  warnings: ImportRowIssue[];
  /** First rows as read, for the preview table */
  sample: Record<string, string>[];
  columns: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  issues: ImportRowIssue[];
  /** Requests sent to the admin (e.g. unknown students) */
  requests: number;
  /** base64 .xlsx of the failed rows with an "Error" column, if any */
  errorFile: string | null;
}

export type ExcelUpload = { fileName: string; contentBase64: string };
