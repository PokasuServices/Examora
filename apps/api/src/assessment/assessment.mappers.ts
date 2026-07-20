import type {
  AdminAttemptDetail,
  AdminAttemptSummary,
  AttemptHistoryItem,
  AttemptResult,
  AttemptReview,
  AttemptState,
  Question as QuestionDto,
  QuestionOption as QuestionOptionDto,
  Quiz as QuizDto,
  QuizDetail as QuizDetailDto,
  QuizQuestionAssignment as QuizQuestionAssignmentDto,
  QuizSection as QuizSectionDto,
  QuizStudentDetail,
  QuizSummary,
} from "@examora/types";
import type {
  Prisma,
  Question,
  QuestionOption,
  Quiz,
  QuizAttempt,
  QuizAttemptAnswer,
  QuizQuestion,
  QuizSection,
} from "@examora/database";
import type { OptionOrder, SnapshotQuestion } from "./quiz-attempts/attempt-snapshot.types";

/** Prisma returns Decimal-typed columns as decimal.js instances, not plain numbers. */
export function decToNum(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function toQuestionOption(row: QuestionOption): QuestionOptionDto {
  return { id: row.id, text: row.text, isCorrect: row.isCorrect, position: row.position };
}

export function toQuestion(row: Question & { options: QuestionOption[] }): QuestionDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    type: row.type,
    difficulty: row.difficulty,
    text: row.text,
    explanation: row.explanation,
    tags: row.tags,
    status: row.status,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    options: row.options.map(toQuestionOption),
  };
}

export function toQuiz(row: Quiz): QuizDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    timeLimitMinutes: row.timeLimitMinutes,
    passingScorePercent: decToNum(row.passingScorePercent),
    negativeMarkingEnabled: row.negativeMarkingEnabled,
    negativeMarksPerWrong: decToNum(row.negativeMarksPerWrong),
    shuffleQuestions: row.shuffleQuestions,
    shuffleOptions: row.shuffleOptions,
    position: row.position,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuizSection(row: QuizSection): QuizSectionDto {
  return {
    id: row.id,
    quizId: row.quizId,
    title: row.title,
    description: row.description,
    position: row.position,
  };
}

export function toQuizQuestionAssignment(
  row: QuizQuestion & {
    question: { text: string; type: Question["type"]; difficulty: Question["difficulty"] };
  },
): QuizQuestionAssignmentDto {
  return {
    id: row.id,
    quizId: row.quizId,
    questionId: row.questionId,
    sectionId: row.sectionId,
    marks: decToNum(row.marks),
    position: row.position,
    question: row.question,
  };
}

export function toQuizDetail(params: {
  quiz: Quiz;
  sections: QuizSection[];
  quizQuestions: (QuizQuestion & {
    question: { text: string; type: Question["type"]; difficulty: Question["difficulty"] };
  })[];
}): QuizDetailDto {
  return {
    ...toQuiz(params.quiz),
    sections: params.sections.map(toQuizSection),
    questions: params.quizQuestions.map(toQuizQuestionAssignment),
    totalQuestions: params.quizQuestions.length,
    totalMarks: params.quizQuestions.reduce((sum, q) => sum + decToNum(q.marks), 0),
  };
}

export function toQuizSummary(
  quiz: Quiz,
  agg: { _count: { _all: number }; _sum: { marks: Prisma.Decimal | null } } | undefined,
): QuizSummary {
  return {
    id: quiz.id,
    subjectId: quiz.subjectId,
    title: quiz.title,
    slug: quiz.slug,
    description: quiz.description,
    timeLimitMinutes: quiz.timeLimitMinutes,
    passingScorePercent: decToNum(quiz.passingScorePercent),
    totalQuestions: agg?._count._all ?? 0,
    totalMarks: decToNum(agg?._sum.marks),
  };
}

export function toQuizStudentDetail(params: {
  quiz: Quiz;
  sections: QuizSection[];
  countBySection: Map<string | null, number>;
  totalQuestions: number;
  totalMarks: Prisma.Decimal | null;
}): QuizStudentDetail {
  return {
    ...toQuizSummary(params.quiz, {
      _count: { _all: params.totalQuestions },
      _sum: { marks: params.totalMarks },
    }),
    negativeMarkingEnabled: params.quiz.negativeMarkingEnabled,
    sections: params.sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      questionCount: params.countBySection.get(s.id) ?? 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Attempts (student)
// ---------------------------------------------------------------------------

type QuestionWithOptions = Question & { options: QuestionOption[] };
type SelectedOptionsHolder = { selectedOptionIds: Prisma.JsonValue };

export function toAttemptState(params: {
  attempt: QuizAttempt;
  quizTitle: string;
  snapshot: SnapshotQuestion[];
  optionOrder: OptionOrder;
  questionById: Map<string, QuestionWithOptions>;
  answerByQuestion: Map<string, SelectedOptionsHolder>;
}): AttemptState {
  const remainingSeconds = params.attempt.expiresAt
    ? Math.max(0, Math.round((params.attempt.expiresAt.getTime() - Date.now()) / 1000))
    : null;

  const questions = params.snapshot.map((s) => {
    const question = params.questionById.get(s.questionId);
    const optionIds = params.optionOrder[s.questionId] ?? [];
    const options = optionIds
      .map((id) => question?.options.find((o) => o.id === id))
      .filter((o): o is QuestionOption => o !== undefined)
      .map((o) => ({ id: o.id, text: o.text }));
    const answer = params.answerByQuestion.get(s.questionId);

    return {
      questionId: s.questionId,
      sectionId: s.sectionId,
      type: question?.type ?? "SINGLE_CHOICE",
      text: question?.text ?? "",
      marks: s.marks,
      options,
      selectedOptionIds: (answer?.selectedOptionIds as string[] | undefined) ?? [],
    };
  });

  return {
    id: params.attempt.id,
    quizId: params.attempt.quizId,
    quizTitle: params.quizTitle,
    status: params.attempt.status,
    startedAt: params.attempt.startedAt.toISOString(),
    expiresAt: params.attempt.expiresAt ? params.attempt.expiresAt.toISOString() : null,
    remainingSeconds,
    totalMarks: decToNum(params.attempt.totalMarks),
    questions,
  };
}

export function toAttemptResult(params: {
  attempt: QuizAttempt;
  quizTitle: string;
}): AttemptResult {
  const { attempt } = params;
  if (attempt.status === "IN_PROGRESS" || !attempt.submittedAt) {
    throw new Error("Cannot build a result for an attempt that has not been finalized");
  }
  const timeTakenSeconds = Math.round(
    (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
  );
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: params.quizTitle,
    status: attempt.status,
    totalMarks: decToNum(attempt.totalMarks),
    obtainedMarks: decToNum(attempt.obtainedMarks),
    percentage: decToNum(attempt.percentage),
    passed: attempt.passed ?? false,
    correctCount: attempt.correctCount ?? 0,
    wrongCount: attempt.wrongCount ?? 0,
    unansweredCount: attempt.unansweredCount ?? 0,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt.toISOString(),
    timeTakenSeconds,
  };
}

export function toAttemptReview(params: {
  attempt: QuizAttempt;
  quizTitle: string;
  snapshot: SnapshotQuestion[];
  questionById: Map<string, QuestionWithOptions>;
  answerByQuestion: Map<string, QuizAttemptAnswer>;
}): AttemptReview {
  const questions = params.snapshot.map((s) => {
    const question = params.questionById.get(s.questionId);
    const answer = params.answerByQuestion.get(s.questionId);
    return {
      questionId: s.questionId,
      text: question?.text ?? "",
      type: question?.type ?? "SINGLE_CHOICE",
      explanation: question?.explanation ?? null,
      options: (question?.options ?? []).map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      selectedOptionIds: (answer?.selectedOptionIds as string[] | undefined) ?? [],
      isCorrect: answer?.isCorrect ?? null,
      marksAwarded: answer?.marksAwarded !== undefined ? decToNum(answer.marksAwarded) : null,
    };
  });
  return {
    id: params.attempt.id,
    quizId: params.attempt.quizId,
    quizTitle: params.quizTitle,
    questions,
  };
}

export function toAttemptHistoryItem(
  row: QuizAttempt & { quiz: { title: string } },
): AttemptHistoryItem {
  return {
    id: row.id,
    quizId: row.quizId,
    quizTitle: row.quiz.title,
    status: row.status,
    percentage: row.percentage !== null ? decToNum(row.percentage) : null,
    passed: row.passed,
    startedAt: row.startedAt.toISOString(),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Admin monitoring
// ---------------------------------------------------------------------------

type AdminAttemptRow = QuizAttempt & { quiz: { title: string }; user: { email: string } };

export function toAdminAttemptSummary(row: AdminAttemptRow): AdminAttemptSummary {
  const effectivelyExpired =
    row.status === "IN_PROGRESS" && row.expiresAt !== null && row.expiresAt.getTime() < Date.now();
  return {
    id: row.id,
    quizId: row.quizId,
    quizTitle: row.quiz.title,
    userId: row.userId,
    userEmail: row.user.email,
    status: row.status,
    effectivelyExpired,
    percentage: row.percentage !== null ? decToNum(row.percentage) : null,
    passed: row.passed,
    startedAt: row.startedAt.toISOString(),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
}

export function toAdminAttemptDetail(params: {
  attempt: AdminAttemptRow;
  snapshot: { questionId: string }[];
  questionById: Map<string, { text: string }>;
  answerByQuestion: Map<string, QuizAttemptAnswer>;
}): AdminAttemptDetail {
  return {
    ...toAdminAttemptSummary(params.attempt),
    totalMarks: decToNum(params.attempt.totalMarks),
    obtainedMarks:
      params.attempt.obtainedMarks !== null ? decToNum(params.attempt.obtainedMarks) : null,
    correctCount: params.attempt.correctCount,
    wrongCount: params.attempt.wrongCount,
    unansweredCount: params.attempt.unansweredCount,
    answers: params.snapshot.map((s) => {
      const answer = params.answerByQuestion.get(s.questionId);
      return {
        questionId: s.questionId,
        questionText: params.questionById.get(s.questionId)?.text ?? "",
        selectedOptionIds: (answer?.selectedOptionIds as string[] | undefined) ?? [],
        isCorrect: answer?.isCorrect ?? null,
        marksAwarded:
          answer?.marksAwarded !== undefined && answer.marksAwarded !== null
            ? decToNum(answer.marksAwarded)
            : null,
      };
    }),
  };
}
