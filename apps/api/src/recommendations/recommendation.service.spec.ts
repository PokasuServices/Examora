import { RecommendationService } from "./recommendation.service";

describe("RecommendationService", () => {
  const courseRecommendations = {
    getContinueLearning: jest.fn(),
    getRecommendedCourses: jest.fn(),
    getSimilarCourses: jest.fn(),
    getLearningPath: jest.fn(),
  };
  const quizRecommendations = { getRecommendedQuizzes: jest.fn() };
  const assignmentRecommendations = { getRecommendedAssignments: jest.fn() };
  const communityRecommendations = { getRelatedDiscussions: jest.fn() };
  const mentorFeedbackService = { listRecentForStudent: jest.fn() };
  const featureFlags = { isEnabled: jest.fn() };

  const service = new RecommendationService(
    courseRecommendations as never,
    quizRecommendations as never,
    assignmentRecommendations as never,
    communityRecommendations as never,
    mentorFeedbackService as never,
    featureFlags as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    featureFlags.isEnabled.mockResolvedValue(true);
    mentorFeedbackService.listRecentForStudent.mockResolvedValue([]);
  });

  it("returns an empty array without calling the domain service when a type is disabled", async () => {
    featureFlags.isEnabled.mockResolvedValue(false);
    const result = await service.getRecommendedCourses("user-1");
    expect(result).toEqual([]);
    expect(courseRecommendations.getRecommendedCourses).not.toHaveBeenCalled();
  });

  it("delegates to the domain service when a type is enabled", async () => {
    courseRecommendations.getRecommendedCourses.mockResolvedValue([{ courseId: "c1" }]);
    const result = await service.getRecommendedCourses("user-1");
    expect(result).toEqual([{ courseId: "c1" }]);
    expect(featureFlags.isEnabled).toHaveBeenCalledWith("COURSE");
  });

  it("does not boost continue-learning scores when there is no recent mentor feedback", async () => {
    courseRecommendations.getContinueLearning.mockResolvedValue([
      { courseId: "c1", score: 50, reason: "50% through" },
    ]);
    mentorFeedbackService.listRecentForStudent.mockResolvedValue([]);

    const result = await service.getContinueLearning("user-1");
    expect(result[0]!.score).toBe(50);
    expect(result[0]!.reason).toBe("50% through");
  });

  it("boosts continue-learning scores when mentor feedback is recent", async () => {
    courseRecommendations.getContinueLearning.mockResolvedValue([
      { courseId: "c1", score: 50, reason: "50% through" },
    ]);
    mentorFeedbackService.listRecentForStudent.mockResolvedValue([{ createdAt: new Date() }]);

    const result = await service.getContinueLearning("user-1");
    expect(result[0]!.score).toBe(60);
    expect(result[0]!.reason).toContain("mentor left recent feedback");
  });

  it("does not boost when the most recent mentor feedback is older than the recency window", async () => {
    courseRecommendations.getContinueLearning.mockResolvedValue([
      { courseId: "c1", score: 50, reason: "50% through" },
    ]);
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mentorFeedbackService.listRecentForStudent.mockResolvedValue([{ createdAt: old }]);

    const result = await service.getContinueLearning("user-1");
    expect(result[0]!.score).toBe(50);
  });

  it("passes the full actor through to community discussions", async () => {
    communityRecommendations.getRelatedDiscussions.mockResolvedValue([]);
    const actor = { id: "user-1", email: "a@example.test", roles: ["STUDENT"] };
    await service.getRelatedDiscussions(actor as never);
    expect(communityRecommendations.getRelatedDiscussions).toHaveBeenCalledWith(actor);
  });
});
