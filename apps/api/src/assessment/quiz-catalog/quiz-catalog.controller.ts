import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PaginatedData, QuizStudentDetail, QuizSummary } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { toQuizStudentDetail, toQuizSummary } from "../assessment.mappers";
import { ListQuizCatalogQueryDto } from "./dto/list-quiz-catalog-query.dto";
import { QuizCatalogService } from "./quiz-catalog.service";

@ApiTags("assessment: quiz catalog")
@Controller("quiz-catalog")
@RequirePermissions("quiz:read")
export class QuizCatalogController {
  constructor(private readonly catalogService: QuizCatalogService) {}

  @Get("quizzes")
  @ApiOperation({ summary: "List published quizzes (filter by subject)" })
  async list(@Query() query: ListQuizCatalogQueryDto): Promise<PaginatedData<QuizSummary>> {
    const { items, total, aggByQuiz } = await this.catalogService.listPublishedQuizzes({
      page: query.page,
      pageSize: query.pageSize,
      subjectId: query.subjectId,
    });
    return {
      items: items.map((quiz) => toQuizSummary(quiz, aggByQuiz.get(quiz.id))),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get("quizzes/:id")
  @ApiOperation({
    summary: "Get published quiz details (metadata + sections, no question content)",
  })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<QuizStudentDetail> {
    return toQuizStudentDetail(await this.catalogService.getDetail(id));
  }
}
