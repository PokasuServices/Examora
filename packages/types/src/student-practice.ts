/**
 * Student module redesign, phases 4–8: practice & tests, attempt analysis,
 * doubts, sketches, daily quiz, colleges & webinars, and the student profile.
 */
import type { DifficultyLevel, ExplanationStep, QuestionResource, QuestionType } from "./quiz";

// ---------------------------------------------------------------------------
// Practice (phase 4)
// ---------------------------------------------------------------------------

export const ANSWER_METHODS = ["KNOWLEDGE", "ELIMINATION", "GUESS"] as const;
export type AnswerMethod = (typeof ANSWER_METHODS)[number];

export interface PracticeTestItem {
  /** Past papers: exam and year the paper follows. */
  exam: string | null;
  paperYear: number | null;
  note: string | null;
  /** Extra XP once for a 100% score. */
  perfectBonusXp: number;
  id: string;
  title: string;
  description: string | null;
  /** Part A (the timed test): question count and marks, sketch questions excluded. */
  questionCount: number;
  totalMarks: number;
  /** Part B (sketching): untimed, done in the paper's Part B tab. */
  sketchCount: number;
  sketchMarks: number;
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

/** One row of a section's marking scheme: questions of one type and the same marks. */
export interface MarkingRow {
  type: QuestionType;
  questionCount: number;
  marksEach: number;
  /** Marks lost for a wrong answer (0 = no negative marking). */
  negativeEach: number;
  /** Multi-select questions that give part marks for some correct options. */
  partialMarking: boolean;
}

export interface PracticeTestSection {
  /** Null for the single implicit section of a test without sections. */
  id: string | null;
  title: string;
  description: string | null;
  questionCount: number;
  totalMarks: number;
  /** Own time for this section in minutes (null = shares the test's time). */
  timeLimitMinutes: number | null;
  marking: MarkingRow[];
}

export interface PracticeTestDetail extends PracticeTestItem {
  crumbs: { course: { id: string; title: string }; category: { id: string; title: string } | null };
  /** Always at least one entry; a test without sections gets one "All questions" section. */
  sections: PracticeTestSection[];
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
  /** Answered and correct questions in this topic, by how the student got the answer. */
  byMethod: Record<AnswerMethod, { answered: number; correct: number }>;
  /** 1-based question numbers in the attempt (as shown on My Answers). */
  questionNumbers: number[];
}

/** Score in one section of a sectioned test. */
export interface SectionScore {
  sectionId: string;
  title: string;
  questionCount: number;
  obtained: number;
  total: number;
  correct: number;
  wrong: number;
  unattempted: number;
  /** Sketch answers still waiting for a reviewer. */
  pending: number;
}

export interface AttemptAnalysis {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  /** Learn topic quizzes: the topic (for the breadcrumb). */
  topic: { id: string; title: string; courseTitle: string | null } | null;
  /** True for a Practice-tab test. */
  isPractice: boolean;
  /** 1 = the student's first attempt at this quiz. */
  attemptNumber: number;
  status: "SUBMITTED" | "AUTO_SUBMITTED";
  submittedAt: string | null;
  /** XP from this quiz awarded during this attempt (first finish, perfect-score bonus). */
  xpEarned: number;
  /** Practice papers: sketch questions in Part B (reported in the paper's Part B tab). */
  partBCount: number;
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
  /** Per-section scores (empty for a test without sections). */
  sections: SectionScore[];
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

export type DoubtKind = "DOUBT" | "EXPLANATION";

/** Discussion image uploads: 1 MB, PNG/JPEG/WebP/GIF. */
export const DOUBT_IMAGE_MAX_BYTES = 1024 * 1024;
export const DOUBT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
/** Longest discussion post (Markdown). */
export const DOUBT_BODY_MAX = 5000;

export interface QuestionDoubtView {
  id: string;
  /** Top-level posts: a doubt or an explanation. Replies are always "DOUBT". */
  kind: DoubtKind;
  /** Markdown; images are "media:<id>" refs. */
  body: string;
  authorName: string;
  isMine: boolean;
  createdAt: string;
  claps: number;
  clappedByMe: boolean;
  popular: boolean;
  replies: Omit<QuestionDoubtView, "replies" | "popular" | "kind">[];
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
  /** The quiz's day (YYYY-MM-DD). */
  date: string;
  /** True for a missed day's quiz taken later (half XP, not on leaderboards). */
  catchUp: boolean;
  correctCount: number;
  total: number;
  totalMs: number;
  xpAwarded: number;
  /** On time: rank that day. Catch-up: where this score would have placed. */
  rank: number;
  candidates: number;
  answers: {
    questionId: string;
    chosenOptionId: string | null;
    correctOptionId: string | null;
    correct: boolean;
    /** Question and explanation, revealed once the quiz is finished. */
    text: string;
    options: { id: string; text: string }[];
    explanation: string | null;
    explanationImageUrl: string | null;
    explanationVideoUrl: string | null;
    explanationSteps: ExplanationStep[];
    resources: QuestionResource[];
  }[];
  leaderboard: {
    rank: number;
    name: string;
    correctCount: number;
    totalMs: number;
    isMe: boolean;
  }[];
}

/** Days back a missed daily quiz can still be taken (catch-up). */
export const DAILY_CATCH_UP_DAYS = 7;

export type DailyDayStatus = "done" | "catch-up" | "missed" | "today" | "no-quiz";

export interface DailyCalendarDay {
  date: string;
  status: DailyDayStatus;
  correct: number | null;
  /** Missed and still inside the catch-up window. */
  canCatchUp: boolean;
}

export interface DailyBoardRow {
  rank: number;
  name: string;
  correct: number;
  totalMs: number;
  /** Days played in the period (week/month boards). */
  days: number;
  isMe: boolean;
}

export interface DailyStanding {
  /** null when the student hasn't played in the period. */
  rank: number | null;
  candidates: number;
  /** Share of other players this student is ahead of, 0–100. */
  percentile: number | null;
  correct: number;
  days: number;
  /** Correct answers needed to pass the next player up (null when first or not playing). */
  toNext: number | null;
  /** Correct answers needed to reach the top 10 (null when already in it). */
  toTop10: number | null;
}

export interface DailyAward {
  key: string;
  group: "streak" | "week" | "month" | "score";
  title: string;
  description: string;
  earned: boolean;
  /** For the progress bar: progress of target. */
  progress: number;
  target: number;
  /** Short current-state note, e.g. "You're #5 this week". */
  detail: string;
}

export interface DailyQuizDashboard {
  today: DailyQuizStatus & { percentile: number | null };
  stats: {
    currentStreak: number;
    bestStreak: number;
    /** On-time and catch-up days, all time. */
    daysPlayed: number;
    daysThisMonth: number;
    /** % correct over the last 30 days (null if no quizzes taken). */
    accuracy30: number | null;
    xpTotal: number;
  };
  todayBoard: DailyBoardRow[];
  week: { start: string; standing: DailyStanding; board: DailyBoardRow[] };
  month: { start: string; standing: DailyStanding; board: DailyBoardRow[] };
  /** The last 28 days, oldest first, ending today. */
  calendar: DailyCalendarDay[];
  awards: DailyAward[];
  catchUpDays: number;
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

export type BatchMode = "OFFLINE" | "ONLINE" | "HYBRID";

/** One weekly class slot: day 0 = Sunday … 6 = Saturday, times "HH:MM" (India time). */
export interface BatchSlot {
  day: number;
  start: string;
  end: string;
}

/** A batch (stored as a cohort): course, mentors, students and class timetable. */
export interface CohortView {
  id: string;
  name: string;
  batch: string | null;
  memberCount: number;
  course: { id: string; title: string } | null;
  mode: BatchMode;
  schedule: BatchSlot[];
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
  meetingUrl: string | null;
  isActive: boolean;
  /** PRIMARY = the batch's mentor (one per batch); COVER = temporary, until `endsOn`. */
  mentors: {
    id: string;
    name: string;
    email: string;
    role: "PRIMARY" | "COVER";
    endsOn: string | null;
  }[];
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

// ---------------------------------------------------------------------------
// Sketch workspace (practice): test upload + revisions, pins, claps, comments
// ---------------------------------------------------------------------------

/** One rating factor of a sketch question, e.g. "Perspective" with what it means. */
export interface RubricFactor {
  title: string;
  description: string | null;
}

export interface SketchVersionView {
  id: string;
  kind: "TEST" | "REVISION";
  /** "Test upload", "Revision 1", … */
  label: string;
  imageRef: string;
  description: string | null;
  createdAt: string;
  pinCount: number;
  /** Owner can delete revisions (never the test upload). */
  canDelete: boolean;
  /** Test upload only: the reviewer's marks, which count toward the test score. */
  expert: { marks: number | null; maxMarks: number; comment: string | null } | null;
  ratings: SketchVersionRatings;
}

/** Scores are 1–5 per factor; totals are scaled to the question's marks. */
export interface SketchVersionRatings {
  self: { scores: Record<string, number>; total: number } | null;
  expert: {
    /** Average per factor across reviewers. */
    scores: Record<string, number>;
    total: number;
    count: number;
    comments: { authorName: string; body: string; createdAt: string }[];
  } | null;
  community: {
    count: number;
    /** How many classmates liked each factor. */
    likes: Record<string, number>;
    total: number;
    comments: { authorName: string; body: string; likedFactors: string[]; createdAt: string }[];
  };
  /** The viewer's own peer feedback on this version (other people's sketches only). */
  myFeedback: { likedFactors: string[]; comment: string | null } | null;
}

export interface SketchWorkCommentView {
  id: string;
  body: string;
  authorName: string;
  authorKind: "OWNER" | "EXPERT" | "PEER";
  mine: boolean;
  createdAt: string;
}

export interface SketchWorkView {
  id: string;
  questionId: string;
  questionText: string;
  rubricTitle: string | null;
  factors: RubricFactor[];
  /** Marks the question carries in the test (totals are scaled to this). */
  maxMarks: number;
  ownerName: string;
  isMine: boolean;
  versions: SketchVersionView[];
  /** Uploads allowed in total, including the test upload. */
  maxVersions: number;
  canUpload: boolean;
  views: number;
  claps: number;
  clappedByMe: boolean;
  reportedByMe: boolean;
  comments: SketchWorkCommentView[];
}

export interface SketchWorkspaceQuestion {
  questionId: string;
  text: string;
  marks: number;
  sectionTitle: string | null;
  rubricTitle: string | null;
  factors: RubricFactor[];
  /** Null until the student has uploaded something for this question. */
  work: SketchWorkView | null;
  canUpload: boolean;
}

export interface SketchWorkspace {
  quiz: { id: string; title: string };
  /** The workspace opens once the student has finished the test. */
  finished: boolean;
  maxVersions: number;
  questions: SketchWorkspaceQuestion[];
}

/** Admin: a named rating-factor set. */
export interface SketchRubricView {
  id: string;
  title: string;
  factors: RubricFactor[];
  questionCount: number;
}

/** Admin: a sketch reported by another student. */
export interface SketchReportView {
  id: string;
  workId: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  reporterName: string;
  ownerName: string;
  questionText: string;
  imageRef: string | null;
  createdAt: string;
}

/** Result of rating your own version or giving feedback on someone else's. */
export interface SketchRatingResult {
  work: SketchWorkView;
  xpAwarded: number;
  /** Peer feedback only: XP-earning feedback left today (max 10). */
  peerXpLeftToday?: number;
}

/** A card in the community grid: one classmate's latest version of a sketch. */
export interface SketchCommunityCard {
  workId: string;
  ownerName: string;
  imageRef: string;
  versionLabel: string;
  versionCount: number;
  description: string | null;
  views: number;
  claps: number;
  /** Average community score scaled to the question's marks, null until rated. */
  communityTotal: number | null;
  feedbackCount: number;
  ratedByMe: boolean;
  updatedAt: string;
}

export interface SketchCommunityPage {
  /** False until the viewer has uploaded and rated their own sketch for this question. */
  unlocked: boolean;
  maxMarks: number;
  items: SketchCommunityCard[];
  nextPage: number | null;
}

/** A sketch question the student can practise and compare (Community challenges). */
export interface SketchChallenge {
  questionId: string;
  text: string;
  courseTitle: string;
  test: { id: string; title: string };
  uploads: number;
  myWorkId: string | null;
  myVersions: number;
  unlocked: boolean;
}

/** Admin: a revision waiting for (or with) expert feedback. */
export interface SketchRevisionQueueItem {
  versionId: string;
  workId: string;
  studentName: string;
  questionText: string;
  label: string;
  imageRef: string;
  description: string | null;
  factors: RubricFactor[];
  createdAt: string;
  myScores: Record<string, number> | null;
  myComment: string | null;
}
