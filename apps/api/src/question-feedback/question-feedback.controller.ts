import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import type { QuestionDoubtView, QuestionReportView } from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { QuestionFeedbackService } from "./question-feedback.service";

export class ReportQuestionDto {
  @ApiProperty({ example: "Option C is also correct" })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  attemptId?: string;
}

export class PostDoubtDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ description: "Reply to this doubt" })
  @IsOptional()
  @IsUUID("4")
  parentId?: string;
}

export class ReportStatusDto {
  @ApiProperty({ enum: ["OPEN", "RESOLVED"] })
  @IsIn(["OPEN", "RESOLVED"])
  status!: "OPEN" | "RESOLVED";
}

@ApiTags("student: question feedback")
@Controller("questions")
@RequirePermissions("quiz:read")
export class QuestionFeedbackController {
  constructor(private readonly feedback: QuestionFeedbackService) {}

  @Post(":id/reports")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Report a problem with a question" })
  async report(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReportQuestionDto,
  ): Promise<void> {
    await this.feedback.report(user.id, id, dto.message, dto.attemptId);
  }

  @Get(":id/doubts")
  @ApiOperation({ summary: "Doubts and explanations posted on a question" })
  doubts(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<QuestionDoubtView[]> {
    return this.feedback.listDoubts(user.id, id);
  }

  @Post(":id/doubts")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Post a doubt (or reply to one)" })
  async post(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PostDoubtDto,
  ): Promise<void> {
    await this.feedback.postDoubt(user.id, id, dto.body, dto.parentId);
  }

  @Post("doubts/:doubtId/clap")
  @ApiOperation({ summary: "Clap (or un-clap) a doubt" })
  clap(@CurrentUser() user: RequestUser, @Param("doubtId", ParseUUIDPipe) doubtId: string) {
    return this.feedback.toggleClap(user.id, doubtId);
  }

  @Delete("doubts/:doubtId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete your own doubt (moderators can delete any)" })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param("doubtId", ParseUUIDPipe) doubtId: string,
  ): Promise<void> {
    await this.feedback.deleteDoubt(
      user.id,
      doubtId,
      user.roles.some((r) => r === "ADMINISTRATOR" || r === "MENTOR"),
    );
  }
}

@ApiTags("admin: question reports")
@Controller("admin/question-reports")
@RequirePermissions("question:manage")
export class AdminQuestionReportsController {
  constructor(private readonly feedback: QuestionFeedbackService) {}

  @Get()
  @ApiOperation({ summary: "Student reports about questions" })
  list(@Query("status") status?: string): Promise<QuestionReportView[]> {
    return this.feedback.listReports(
      status === "OPEN" || status === "RESOLVED" ? status : undefined,
    );
  }

  @Patch(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Resolve or reopen a report" })
  async setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusDto,
  ): Promise<void> {
    await this.feedback.setReportStatus(id, dto.status);
  }
}
