import { Injectable } from "@nestjs/common";
import type { RelatedDiscussionRecommendation } from "@examora/types";
import type { RequestUser } from "../../auth/types/request-user";
import { CommunitySearchService } from "../../community/search/community-search.service";
import { clampScore, rankAndExplain } from "../recommendation-scoring.util";
import { RecommendationContextService } from "../recommendation-context.service";

const DEFAULT_LIMIT = 10;

/**
 * Related Community Discussions (Sprint 11, ADR-0021 §2) — reuses
 * CommunitySearchService.search() (Sprint 7) seeded with the student's
 * enrolled course titles, rather than a new query against Thread directly.
 */
@Injectable()
export class CommunityRecommendationService {
  constructor(
    private readonly searchService: CommunitySearchService,
    private readonly context: RecommendationContextService,
  ) {}

  async getRelatedDiscussions(
    actor: RequestUser,
    limit = DEFAULT_LIMIT,
  ): Promise<RelatedDiscussionRecommendation[]> {
    const enrollments = await this.context.getActiveEnrollments(actor.id);
    if (enrollments.length === 0) return [];

    const topEnrollments = enrollments.slice(0, 3);
    const resultLists = await Promise.all(
      topEnrollments.map((enrollment) =>
        this.searchService.search(actor, {
          q: enrollment.courseTitle,
          page: 1,
          pageSize: 5,
        }),
      ),
    );

    const candidates: Array<{
      item: RelatedDiscussionRecommendation;
      score: number;
      reason: string;
    }> = [];
    const seen = new Set<string>();
    topEnrollments.forEach((enrollment, index) => {
      for (const thread of resultLists[index]!.items) {
        if (seen.has(thread.id)) continue;
        seen.add(thread.id);
        candidates.push({
          item: {
            threadId: thread.id,
            threadTitle: thread.title,
            boardId: thread.boardId,
            score: 0,
            reason: "",
          },
          score: clampScore(50 + thread.likeCount * 2),
          reason: `Related to ${enrollment.courseTitle}`,
        });
      }
    });

    return rankAndExplain(candidates, limit).map((c) => ({
      ...c.item,
      score: c.score,
      reason: c.reason,
    }));
  }
}
