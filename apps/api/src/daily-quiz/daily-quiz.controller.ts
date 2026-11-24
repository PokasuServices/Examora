import { Body, Controller, Get, Post } from "@nestjs/common";
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
import type { DailyQuizQuestion, DailyQuizResult, DailyQuizStatus } from "@examora/types";
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

  @Get("today/leaderboard")
  @ApiOperation({ summary: "Today's top 10 (score, then time)" })
  leaderboard(@CurrentUser() user: RequestUser) {
    return this.daily.leaderboard(user.id);
  }
}
