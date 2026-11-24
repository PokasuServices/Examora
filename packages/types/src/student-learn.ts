/**
 * Student "Learn" section (student module redesign): exam → subjects →
 * topics → lessons + topic quizzes. Progress counts a topic's lessons
 * completed plus its quizzes attempted (at least one finished attempt).
 */
import type { DifficultyLevel, ExplanationStep, QuestionResource } from "./quiz";
import type { AnswerMethod } from "./student-practice";

export type SubjectKind = "SUBJECT" | "ESSENTIALS";

/** A course the student holds an active licence for (the exam picker). */
export interface LearnCourseOption {
  id: string;
  title: string;
  examType: string | null;
}

export interface LearnSubjectCard {
  id: string;
  title: string;
  description: string | null;
  kind: SubjectKind;
  icon: string | null;
  color: string | null;
  topicsTotal: number;
  /** Topics at 100% (every lesson completed and every quiz attempted). */
  topicsDone: number;
  /** 0–100 across all of the subject's lessons and quizzes. */
  percent: number;
  /** Topic titles, so the page can search topics without another request. */
  topics: { id: string; title: string }[];
}

export interface SyllabusHeatmap {
  examLabel: string;
  years: number[];
  rows: { subjectId: string; subjectTitle: string; counts: Record<string, number> }[];
}

export interface LearnCourseOverview {
  course: { id: string; title: string; examType: string | null; nextExamDate: string | null };
  subjects: LearnSubjectCard[];
  /** One entry per exam label (the heatmap's exam dropdown). */
  heatmaps: SyllabusHeatmap[];
}

export interface LearnTopicCard {
  id: string;
  title: string;
  description: string | null;
  position: number;
  percent: number;
}

export interface LearnCrumbs {
  course: { id: string; title: string };
  subject?: { id: string; title: string };
  topic?: { id: string; title: string };
}

export interface LearnSubjectDetail {
  subject: { id: string; title: string; description: string | null; kind: SubjectKind };
  crumbs: LearnCrumbs;
  topics: LearnTopicCard[];
}

export interface LearnTopicLesson {
  id: string;
  title: string;
  xpReward: number;
  completed: boolean;
}

export interface LearnTopicQuiz {
  id: string;
  title: string;
  maxAttempts: number | null;
  level: DifficultyLevel | null;
  xpReward: number;
  attemptsUsed: number;
  /** At least one finished attempt. */
  attempted: boolean;
}

export type TopicRatingValue = 1 | 2 | 3 | 4 | 5;

export interface LearnTopicDetail {
  topic: { id: string; title: string; description: string | null };
  crumbs: LearnCrumbs;
  lessons: LearnTopicLesson[];
  quizzes: LearnTopicQuiz[];
  myRating: TopicRatingValue | null;
  /** Next things to do: the first unfinished lessons, then unattempted quizzes. */
  suggestions: { kind: "lesson" | "quiz"; id: string; title: string }[];
}

export interface LearnLessonDetail {
  lesson: {
    id: string;
    title: string;
    contentType: "TEXT" | "VIDEO" | "PDF" | "IMAGE" | "ARTICLE";
    body: string | null;
    contentUrl: string | null;
    xpReward: number;
    completed: boolean;
  };
  crumbs: LearnCrumbs;
  /** Neighbouring lessons in the same topic, for Previous / Next. */
  previousLessonId: string | null;
  nextLessonId: string | null;
  /** Practice questions shown inside the lesson (e.g. past-paper examples). */
  practiceQuestions: LessonPracticeQuestion[];
}

export type LessonQuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "NUMERIC";

/** A question inside a lesson. Answers and explanation appear only after the student answers. */
export interface LessonPracticeQuestion {
  /** The lesson-question link id (used to answer). */
  id: string;
  questionId: string;
  type: LessonQuestionType;
  text: string;
  imageUrl: string | null;
  options: { id: string; text: string; imageUrl: string | null }[];
  answer: LessonPracticeAnswer | null;
}

export interface LessonPracticeAnswer {
  selectedOptionIds: string[];
  numericValue: number | null;
  method: AnswerMethod | null;
  correct: boolean;
  correctOptionIds: string[];
  numericRange: { min: number; max: number } | null;
  explanation: string | null;
  explanationImageUrl: string | null;
  explanationVideoUrl: string | null;
  explanationSteps: ExplanationStep[];
  resources: QuestionResource[];
}

/** Admin: a question attached to a lesson. */
export interface AdminLessonQuestion {
  id: string;
  questionId: string;
  text: string;
  type: string;
  position: number;
}

export interface LearnLessonCompleteResult {
  /** XP newly awarded by this call (0 if it was already completed). */
  xpAwarded: number;
}

export interface LearnQuizInfo {
  quiz: {
    id: string;
    title: string;
    questionCount: number;
    maxAttempts: number | null;
    xpReward: number;
    level: DifficultyLevel | null;
    timeLimitMinutes: number | null;
    /** Topic quizzes double the XP on a perfect score. */
    doublesOnPerfect: boolean;
  };
  crumbs: LearnCrumbs;
  attemptsUsed: number;
  inProgressAttemptId: string | null;
  lastFinishedAttemptId: string | null;
}

/** Result of an admin bulk licence grant/revoke. */
export interface BulkLicenceResult {
  /** Students targeted (all students, or the selected ones that exist). */
  students: number;
  courses: number;
  /** Licences created, reactivated (grant) or revoked (revoke). */
  changed: number;
}
