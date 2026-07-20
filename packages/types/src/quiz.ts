import type { ContentStatus } from "./content";

/** Mirrors the `question_type` enum in database/prisma/schema.prisma (ADR-0014). */
export const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Mirrors the `difficulty_level` enum. */
export const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** Mirrors the `quiz_attempt_status` enum. */
export const QUIZ_ATTEMPT_STATUSES = ["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED"] as const;
export type QuizAttemptStatus = (typeof QUIZ_ATTEMPT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Question bank (admin)
// ---------------------------------------------------------------------------

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface Question {
  id: string;
  subjectId: string | null;
  type: QuestionType;
  difficulty: DifficultyLevel;
  text: string;
  explanation: string | null;
  tags: string[];
  status: ContentStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
  options: QuestionOption[];
}

// ---------------------------------------------------------------------------
// Quiz authoring (admin)
// ---------------------------------------------------------------------------

export interface Quiz {
  id: string;
  subjectId: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: ContentStatus;
  timeLimitMinutes: number | null;
  passingScorePercent: number;
  negativeMarkingEnabled: boolean;
  negativeMarksPerWrong: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  position: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuizSection {
  id: string;
  quizId: string;
  title: string;
  description: string | null;
  position: number;
}

/** A question assigned to a quiz, with a preview of the question for admin authoring UIs. */
export interface QuizQuestionAssignment {
  id: string;
  quizId: string;
  questionId: string;
  sectionId: string | null;
  marks: number;
  position: number;
  question: { text: string; type: QuestionType; difficulty: DifficultyLevel };
}

export interface QuizDetail extends Quiz {
  sections: QuizSection[];
  questions: QuizQuestionAssignment[];
  totalQuestions: number;
  totalMarks: number;
}

// ---------------------------------------------------------------------------
// Student catalog (published only)
// ---------------------------------------------------------------------------

export interface QuizSummary {
  id: string;
  subjectId: string | null;
  title: string;
  slug: string;
  description: string | null;
  timeLimitMinutes: number | null;
  passingScorePercent: number;
  totalQuestions: number;
  totalMarks: number;
}

export interface QuizStudentDetail extends QuizSummary {
  negativeMarkingEnabled: boolean;
  sections: { id: string; title: string; description: string | null; questionCount: number }[];
}

// ---------------------------------------------------------------------------
// Attempts (student)
// ---------------------------------------------------------------------------

/** A question as presented during an in-progress attempt — never carries correctness. */
export interface AttemptQuestion {
  questionId: string;
  sectionId: string | null;
  type: QuestionType;
  text: string;
  marks: number;
  options: { id: string; text: string }[];
  selectedOptionIds: string[];
}

/** Full state of an attempt while it is being taken (or reviewed structurally after close). */
export interface AttemptState {
  id: string;
  quizId: string;
  quizTitle: string;
  status: QuizAttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  remainingSeconds: number | null;
  totalMarks: number;
  questions: AttemptQuestion[];
}

/** Result summary — only meaningful once an attempt is SUBMITTED/AUTO_SUBMITTED. */
export interface AttemptResult {
  id: string;
  quizId: string;
  quizTitle: string;
  status: QuizAttemptStatus;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  startedAt: string;
  submittedAt: string;
  timeTakenSeconds: number;
}

export interface AttemptReviewQuestion {
  questionId: string;
  text: string;
  type: QuestionType;
  explanation: string | null;
  options: { id: string; text: string; isCorrect: boolean }[];
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export interface AttemptReview {
  id: string;
  quizId: string;
  quizTitle: string;
  questions: AttemptReviewQuestion[];
}

export interface AttemptHistoryItem {
  id: string;
  quizId: string;
  quizTitle: string;
  status: QuizAttemptStatus;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
}

// ---------------------------------------------------------------------------
// Admin monitoring & results
// ---------------------------------------------------------------------------

export interface AdminAttemptSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userEmail: string;
  status: QuizAttemptStatus;
  /** True when an IN_PROGRESS attempt is past expiresAt but not yet accessed to auto-finalize (TD-021). */
  effectivelyExpired: boolean;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface AdminAttemptDetail extends AdminAttemptSummary {
  totalMarks: number;
  obtainedMarks: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  unansweredCount: number | null;
  answers: {
    questionId: string;
    questionText: string;
    selectedOptionIds: string[];
    isCorrect: boolean | null;
    marksAwarded: number | null;
  }[];
}

export interface QuizResultDashboard {
  quizId: string;
  quizTitle: string;
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  averagePercentage: number | null;
  passCount: number;
  failCount: number;
  passRate: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
}
