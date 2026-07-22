import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { THREAD_TYPES, type ThreadType } from "@examora/types";

export class CreateThreadDto {
  @ApiProperty()
  @IsUUID()
  boardId!: string;

  @ApiPropertyOptional({ enum: THREAD_TYPES, default: "DISCUSSION" })
  @IsOptional()
  @IsEnum(THREAD_TYPES)
  type?: ThreadType;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  body!: string;

  @ApiPropertyOptional({ description: "At most one related* field may be set (ADR-0017)" })
  @IsOptional()
  @IsUUID()
  relatedCourseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedLessonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedQuizId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedAssignmentId?: string;
}
