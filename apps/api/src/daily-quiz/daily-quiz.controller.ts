import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type {
  DailyQuizDashboard,
  DailyQuizQuestion,
  DailyQuizResult,
  DailyQuizStatus,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { DailyQuizService } from "./daily-quiz.service";

export class DailyAnswerDto {
  @ApiProperty()
  @IsUUID("4")
  questionId!: string;

  @ApiPropertyOptional({ nullable: true, description: "null = no answer in time" })
  @IsOptional()
  @IsUUID("4")
  optionId?: string | null;

  @ApiProperty({ description: "Milliseconds taken (capped at 10 000)" })
  @IsInt()
  @Min(0)
  @Max(60_000)
  ms!: number;
}

export class FinishDailyDto {
  @ApiProperty({ type: [DailyAnswerDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DailyAnswerDto)
  answers!: DailyAnswerDto[];
}

@ApiTags("student: daily quiz")
@Controller("daily-quiz")
@RequirePermissions("quiz:read")
export class DailyQuizController {
  constructor(private readonly daily: DailyQuizService) {}

  @Get("today")
  @ApiOperation({ summary: "Today's quiz status and my result" })
  status(@CurrentUser() user: RequestUser): Promise<DailyQuizStatus> {
    return this.daily.status(user.id);
  }

  @Post("today/start")
  @ApiOperation({ summary: "Start today's quiz and get its questions" })
  start(@CurrentUser() user: RequestUser): Promise<DailyQuizQuestion[]> {
    return this.daily.start(user.id);
  }

  @Post("today/finish")
  @ApiOperation({ summary: "Submit today's answers; returns score, rank and XP" })
  finish(@CurrentUser() user: RequestUser, @Body() dto: FinishDailyDto): Promise<DailyQuizResult> {
    return this.daily.finish(
      user.id,
      dto.answers.map((a) => ({
        questionId: a.questionId,
        optionId: a.optionId ?? null,
        ms: a.ms,
      })),
    );
  }

  @Get("me")
  @ApiOperation({
    summary: "My daily quiz dashboard: streaks, calendar, standings (today/week/month), awards",
  })
  dashboard(@CurrentUser() user: RequestUser): Promise<DailyQuizDashboard> {
    return this.daily.dashboard(user.id);
  }

  @Post("days/:date/start")
  @ApiOperation({ summary: "Catch up: start a missed quiz from the last 7 days (YYYY-MM-DD)" })
  startDay(
    @CurrentUser() user: RequestUser,
    @Param("date") date: string,
  ): Promise<DailyQuizQuestion[]> {
    return this.daily.start(user.id, date);
  }

  @Post("days/:date/finish")
  @ApiOperation({ summary: "Catch up: submit a missed quiz (half XP, not on leaderboards)" })
  finishDay(
    @CurrentUser() user: RequestUser,
    @Param("date") date: string,
    @Body() dto: FinishDailyDto,
  ): Promise<DailyQuizResult> {
    return this.daily.finish(
      user.id,
      dto.answers.map((a) => ({
        questionId: a.questionId,
        optionId: a.optionId ?? null,
        ms: a.ms,
      })),
      date,
    );
  }

  @Get("today/leaderboard")
  @ApiOperation({ summary: "Today's top 10 (score, then time)" })
  leaderboard(@CurrentUser() user: RequestUser) {
    return this.daily.leaderboard(user.id);
  }
}
