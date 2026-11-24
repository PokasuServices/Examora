/**
 * Student module redesign, phases 4–8: practice & tests, attempt analysis,
 * doubts, sketches, daily quiz, colleges & webinars, and the student profile.
 */
import type { DifficultyLevel, QuestionType } from "./quiz";

// ---------------------------------------------------------------------------
// Practice (phase 4)
// ---------------------------------------------------------------------------

export const ANSWER_METHODS = ["KNOWLEDGE", "ELIMINATION", "GUESS"] as const;
export type AnswerMethod = (typeof ANSWER_METHODS)[number];

export interface PracticeTestItem {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  totalMarks: number;
  timeLimitMinutes: number | null;
  xpReward: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  sectionCount: number;
  /** Last finished attempt's score, if any. */
  lastScore: { obtained: number; total: number; attemptId: string } | null;
  inProgressAttemptId: string | null;
  /** Locked until the named test has a finished attempt. */
  lockedBy: { id: string; title: string } | null;
}

export interface PracticeCategoryView {
  id: string;
  title: string;
  description: string | null;
  tests: PracticeTestItem[];
}

/** A topic the student keeps getting wrong despite answering from knowledge (Practice → "Needs attention"). */
export interface WeakTopicAction {
  topicId: string;
  topicTitle: string;
  subjectTitle: string;
  answered: number;
  wrongFromKnowledge: number;
}

export interface PracticeOverview {
  course: { id: string; title: string };
  categories: PracticeCategoryView[];
  weakTopics: WeakTopicAction[];
}

export interface PracticeTestDetail extends PracticeTestItem {
  crumbs: { course: { id: string; title: string }; category: { id: string; title: string } | null };
  sections: { id: string; title: string; questionCount: number }[];
  negativeMarking: boolean;
  requireAllVisited: boolean;
}

/** Per-question attempt metadata the test screen records as the student works. */
export interface AttemptQuestionMeta {
  visited: boolean;
  flagged: boolean;
  method: AnswerMethod | null;
  timeSpentSeconds: number;
  /** UPLOAD questions: "media:<id>" of the uploaded sketch. */
  uploadRef: string | null;
}

// ---------------------------------------------------------------------------
// Attempt analysis (phase 5)
// ---------------------------------------------------------------------------

export interface MethodStats {
  attempted: number;
  correct: number;
  wrong: number;
}

export interface TopicInsight {
  topicId: string;
  topicTitle: string;
  subjectTitle: string;
  correct: number;
  total: number;
  /** Marks scored / available in this topic, guesses counted as wrong. */
  trueScore: number;
  available: number;
  timeSeconds: number;
  /** Marks still available to gain in this topic. */
  gain: number;
  reason: string;
}

export interface AttemptAnalysis {
  attemptId: string;
  quizTitle: string;
  obtainedMarks: number;
  totalMarks: number;
  /** obtainedMarks minus marks earned by answers the student said they guessed. */
  trueScore: number;
  marksFromGuesses: number;
  /** Rank among first attempts of this quiz (1 = best); null for a quiz with no finished first attempts. */
  rank: number | null;
  candidates: number;
  /** Share of other candidates this score beats, 0–100. */
  percentile: number | null;
  methods: Record<AnswerMethod, MethodStats>;
  unattempted: number;
  subjects: {
    subjectId: string | null;
    title: string;
    correct: number;
    total: number;
    percent: number;
  }[];
  /** Topics where knowledge-based answers went wrong. */
  weakTopics: TopicInsight[];
  /** Topics with low accuracy or skipped questions. */
  opportunityTopics: TopicInsight[];
  /** Topics answered fully correctly. */
  strongTopics: TopicInsight[];
  /** Topics ranked by marks per second: tackle the first ones early, the last ones late. */
  attemptOrder: { first: TopicInsight[]; last: TopicInsight[] };
  totalTimeSeconds: number;
  timeBuckets: { label: string; questions: number; accuracy: number | null }[];
  timeUsage: {
    wiselyUsed: { questions: number; seconds: number };
    overSpent: { questions: number; seconds: number };
    lost: { questions: number; seconds: number };
    wasted: { questions: number; seconds: number };
  };
}

export interface LeaderboardEntry {
  rank: number;
  /** First name and last initial only. */
  name: string;
  obtainedMarks: number;
  totalMarks: number;
  timeSeconds: number;
  isMe: boolean;
}

/** Answer review entry enriched with the method and time (extends AttemptReviewQuestion on the client). */
export interface AttemptReviewMeta {
  questionId: string;
  method: AnswerMethod | null;
  timeSpentSeconds: number;
  subjectTitle: string | null;
  topicTitle: string | null;
}

// ---------------------------------------------------------------------------
// Doubts & reports (phase 5)
// ---------------------------------------------------------------------------

export interface QuestionDoubtView {
  id: string;
  body: string;
  authorName: string;
  isMine: boolean;
  createdAt: string;
  claps: number;
  clappedByMe: boolean;
  popular: boolean;
  replies: Omit<QuestionDoubtView, "replies" | "popular">[];
}

export interface QuestionReportView {
  id: string;
  questionId: string;
  questionText: string;
  reporterEmail: string;
  message: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Sketches (phase 6)
// ---------------------------------------------------------------------------

export interface SketchView {
  answerId: string;
  questionId: string;
  questionText: string;
  criteria: string[];
  marks: number;
  imageRef: string;
  selfScores: Record<string, number> | null;
  expertScores: Record<string, number> | null;
  expertComment: string | null;
  marksAwarded: number | null;
  peerAverage: number | null;
  peerCount: number;
}

/** A comment pinned to a spot on a sketch; x and y are 0..1 of the image size. */
export interface SketchCommentView {
  id: string;
  x: number;
  y: number;
  body: string;
  authorName: string;
  /** Who wrote it, relative to the sketch: the owner, a staff expert, or another student. */
  authorKind: "OWNER" | "EXPERT" | "PEER";
  mine: boolean;
  createdAt: string;
}

export interface SketchGalleryItem {
  answerId: string;
  authorName: string;
  imageRef: string;
  peerAverage: number | null;
  peerCount: number;
  myRating: number | null;
}

export interface SketchReviewQueueItem extends SketchView {
  studentEmail: string;
  quizTitle: string;
  submittedAt: string | null;
}

// ---------------------------------------------------------------------------
// Daily quiz (phase 7)
// ---------------------------------------------------------------------------

export interface DailyQuizStatus {
  date: string;
  questionCount: number;
  secondsPerQuestion: number;
  available: boolean;
  attempt: { correctCount: number; totalMs: number; rank: number; candidates: number } | null;
  inProgress: boolean;
  /** Students who have finished today's quiz so far. */
  attemptedCount: number;
}

export interface DailyQuizQuestion {
  questionId: string;
  text: string;
  imageUrl: string | null;
  options: { id: string; text: string; imageUrl: string | null }[];
}

export interface DailyQuizResult {
  correctCount: number;
  total: number;
  totalMs: number;
  xpAwarded: number;
  rank: number;
  candidates: number;
  answers: {
    questionId: string;
    chosenOptionId: string | null;
    correctOptionId: string | null;
    correct: boolean;
  }[];
  leaderboard: {
    rank: number;
    name: string;
    correctCount: number;
    totalMs: number;
    isMe: boolean;
  }[];
}

// ---------------------------------------------------------------------------
// Colleges & webinars (phase 8)
// ---------------------------------------------------------------------------

export const COLLEGE_CATEGORIES = ["ARCHITECTURE", "DESIGN", "FASHION", "STUDY_ABROAD"] as const;
export type CollegeCategory = (typeof COLLEGE_CATEGORIES)[number];

export interface CollegeSummary {
  id: string;
  name: string;
  slug: string;
  city: string;
  categories: CollegeCategory[];
  logoUrl: string | null;
  applicationFee: number | null;
  shortlisted: boolean;
}

export interface WebinarSummary {
  id: string;
  title: string;
  slug: string;
  collegeName: string | null;
  bannerUrl: string | null;
  startsAt: string;
  endsAt: string;
  registered: boolean;
}

export interface CollegeDetail extends CollegeSummary {
  website: string | null;
  description: string | null;
  enquired: boolean;
  webinars: WebinarSummary[];
}

export interface WebinarDetail extends WebinarSummary {
  description: string | null;
  collegeId: string | null;
  /** Only sent to registered students. */
  joinUrl: string | null;
  registrations: number;
}

export interface AdminCollege extends CollegeSummary {
  website: string | null;
  description: string | null;
  published: boolean;
  position: number;
  enquiryCount: number;
  shortlistCount: number;
}

export interface AdminWebinar extends WebinarDetail {
  published: boolean;
}

export interface CollegeEnquiryView {
  id: string;
  collegeName: string;
  studentName: string;
  studentEmail: string;
  message: string | null;
  status: "NEW" | "CONTACTED";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Profile (phase 8)
// ---------------------------------------------------------------------------

export interface ProfileActivityItem {
  at: string;
  kind: "LESSON" | "QUIZ" | "XP" | "DAILY_QUIZ" | "SKETCH";
  title: string;
  detail: string | null;
}

export interface ProfilePerformancePoint {
  attemptId: string;
  quizTitle: string;
  submittedAt: string;
  percent: number;
  /** Share of the score earned per answer method (percent points). */
  byMethod: Record<AnswerMethod, number>;
}

export interface ProfileOverview {
  name: string;
  email: string;
  city: string | null;
  examYear: number | null;
  courses: { id: string; title: string }[];
  totalXp: number;
  cohorts: { id: string; name: string; batch: string | null }[];
  mentorComments: { id: string; body: string; mentorName: string; createdAt: string }[];
}

export interface RevisionItem {
  kind: "FLAGGED" | "WEAK_TOPIC";
  questionId?: string;
  questionText?: string;
  quizTitle?: string;
  attemptId?: string;
  topicId?: string;
  topicTitle?: string;
  subjectTitle?: string;
}

export interface GoalView {
  courseId: string;
  courseTitle: string;
  targetPercent: number | null;
  note: string | null;
  /** Average of the student's latest test percentages in the course. */
  currentPercent: number | null;
}

export interface CheckpointView {
  id: string;
  courseTitle: string;
  title: string;
  dueDate: string | null;
  done: boolean;
}

export interface CohortView {
  id: string;
  name: string;
  batch: string | null;
  memberCount: number;
}

/** Shape used by question payloads that include topic & sketch criteria (admin). */
export interface QuestionTopicFields {
  topicId: string | null;
  criteria: string[];
}

export type { DifficultyLevel, QuestionType };

/** The caller's share link for a practice test and what it has earned. */
export interface TestShareInfo {
  /** Null until the student first shares the test. */
  code: string | null;
  /** Different students who opened the link. */
  visitors: number;
  xpEarned: number;
  xpPerVisitor: number;
  /** Visitors that earn XP; later ones still count. */
  maxRewarded: number;
}

export interface TestShareVisitResult {
  quizId: string;
  /** True when this visit was new (and may have earned the sharer XP). */
  counted: boolean;
}
