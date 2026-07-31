import { Injectable } from "@nestjs/common";
import type {
  AssignmentRecommendation,
  ContinueLearningItem,
  CourseRecommendation,
  LearningPathStep,
  QuizRecommendation,
  RelatedDiscussionRecommendation,
  SimilarCourseRecommendation,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { MentorFeedbackService } from "../mentoring/feedback/mentor-feedback.service";
import { AssignmentRecommendationService } from "./assignment/assignment-recommendation.service";
import { CommunityRecommendationService } from "./community/community-recommendation.service";
import { CourseRecommendationService } from "./course/course-recommendation.service";
import { RecommendationFeatureFlagsService } from "./feature-flags/recommendation-feature-flags.service";
import { clampScore } from "./recommendation-scoring.util";
import { QuizRecommendationService } from "./quiz/quiz-recommendation.service";

const RECENT_FEEDBACK_WINDOW_DAYS = 14;
const RECENT_FEEDBACK_BOOST = 10;

/**
 * Orchestrating facade (Sprint 11, ADR-0021 §2) — the "RecommendationService"
 * named in the kickoff. Applies the per-type feature-flag kill switch (a
 * disabled type returns an empty list, never an error, so the UI can just
 * hide the section) and layers the Mentor Feedback engagement signal onto
 * Continue Learning: recent feedback presence/recency only, never its text
 * content (no NLP — ADR-0021 §2).
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly courseRecommendations: CourseRecommendationService,
    private readonly quizRecommendations: QuizRecommendationService,
    private readonly assignmentRecommendations: AssignmentRecommendationService,
    private readonly communityRecommendations: CommunityRecommendationService,
    private readonly mentorFeedbackService: MentorFeedbackService,
    private readonly featureFlags: RecommendationFeatureFlagsService,
  ) {}

  async getContinueLearning(userId: string): Promise<ContinueLearningItem[]> {
    if (!(await this.featureFlags.isEnabled("CONTINUE_LEARNING"))) return [];
    const items = await this.courseRecommendations.getContinueLearning(userId);
    const hasRecentMentorFeedback = await this.hasRecentMentorFeedback(userId);
    if (!hasRecentMentorFeedback) return items;

    return items.map((item) => ({
      ...item,
      score: clampScore(item.score + RECENT_FEEDBACK_BOOST),
      reason: `${item.reason} — your mentor left recent feedback`,
    }));
  }

  async getRecommendedCourses(userId: string): Promise<CourseRecommendation[]> {
    if (!(await this.featureFlags.isEnabled("COURSE"))) return [];
    return this.courseRecommendations.getRecommendedCourses(userId);
  }

  async getSimilarCourses(
    userId: string,
    courseId?: string,
  ): Promise<SimilarCourseRecommendation[]> {
    if (!(await this.featureFlags.isEnabled("SIMILAR_COURSES"))) return [];
    return this.courseRecommendations.getSimilarCourses(userId, courseId);
  }

  async getLearningPath(userId: string): Promise<LearningPathStep[]> {
    if (!(await this.featureFlags.isEnabled("LEARNING_PATH"))) return [];
    return this.courseRecommendations.getLearningPath(userId);
  }

  async getRecommendedQuizzes(userId: string): Promise<QuizRecommendation[]> {
    if (!(await this.featureFlags.isEnabled("QUIZ"))) return [];
    return this.quizRecommendations.getRecommendedQuizzes(userId);
  }

  async getRecommendedAssignments(userId: string): Promise<AssignmentRecommendation[]> {
    if (!(await this.featureFlags.isEnabled("ASSIGNMENT"))) return [];
    return this.assignmentRecommendations.getRecommendedAssignments(userId);
  }

  async getRelatedDiscussions(actor: RequestUser): Promise<RelatedDiscussionRecommendation[]> {
    if (!(await this.featureFlags.isEnabled("COMMUNITY_DISCUSSION"))) return [];
    return this.communityRecommendations.getRelatedDiscussions(actor);
  }

  private async hasRecentMentorFeedback(userId: string): Promise<boolean> {
    const recent = await this.mentorFeedbackService.listRecentForStudent(userId, 1);
    if (recent.length === 0) return false;
    const cutoff = new Date(Date.now() - RECENT_FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return recent[0]!.createdAt >= cutoff;
  }
}
