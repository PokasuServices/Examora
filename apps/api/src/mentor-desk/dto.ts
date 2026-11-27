import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  ATTENDANCE_STATUSES,
  REPORT_KINDS,
  REVIEWABLE_CONTENT_TYPES,
  SHOUTOUT_BADGES,
  type AttendanceStatus,
  type ProgressReportKind,
  type ReviewableContentType,
  type ShoutoutBadge,
} from "@examora/types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RangeQueryDto {
  @ApiProperty() @Matches(DAY, { message: "Use a date like 2026-11-24" }) from!: string;
  @ApiProperty() @Matches(DAY, { message: "Use a date like 2026-11-30" }) to!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") cohortId?: string;
}

export class OverviewQueryDto {
  @ApiProperty() @Matches(MONTH, { message: "Use a month like 2026-11" }) month!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") courseId?: string;
}

export class ExportQueryDto {
  @ApiProperty() @IsUUID("4") cohortId!: string;
  @ApiProperty({ enum: ["daily", "weekly", "monthly"] })
  @IsIn(["daily", "weekly", "monthly"])
  period!: "daily" | "weekly" | "monthly";
  @ApiProperty() @Matches(DAY, { message: "Use a date like 2026-11-24" }) date!: string;
}

export class AttendanceRecordDto {
  @ApiProperty() @IsUUID("4") userId!: string;
  @ApiProperty({ enum: ATTENDANCE_STATUSES })
  @IsIn([...ATTENDANCE_STATUSES])
  status!: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) note?: string | null;
}

export class MarkAttendanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) topic?: string | null;
  @ApiProperty({ type: [AttendanceRecordDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}

export class AddSessionDto {
  @ApiProperty() @IsUUID("4") cohortId!: string;
  @ApiProperty() @Matches(DAY) date!: string;
  @ApiProperty() @Matches(TIME, { message: "Use a 24-hour time like 18:00" }) start!: string;
  @ApiProperty() @Matches(TIME, { message: "Use a 24-hour time like 19:30" }) end!: string;
  @ApiPropertyOptional({ enum: ["OFFLINE", "ONLINE"] })
  @IsOptional()
  @IsIn(["OFFLINE", "ONLINE"])
  mode?: "OFFLINE" | "ONLINE";
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) topic?: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cancelled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) topic?: string | null;
}

export class UploadDto {
  @ApiProperty() @IsString() @MaxLength(200) fileName!: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(8_000_000) contentBase64!: string;
}

export class DoubtsQueryDto {
  @ApiPropertyOptional({ enum: ["open", "resolved", "all"] })
  @IsOptional()
  @IsIn(["open", "resolved", "all"])
  status?: "open" | "resolved" | "all";
  @ApiPropertyOptional({ enum: ["batches", "course"] })
  @IsOptional()
  @IsIn(["batches", "course"])
  scope?: "batches" | "course";
}

export class DoubtReplyDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(5000) body!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() resolve?: boolean;
}

export class ResolveDto {
  @ApiProperty() @IsBoolean() resolved!: boolean;
}

export class CalendarQueryDto {
  @ApiProperty() @IsUUID("4") courseId!: string;
  @ApiProperty() @Matches(DAY) from!: string;
  @ApiProperty() @Matches(DAY) to!: string;
}

export class PoolQueryDto {
  @ApiProperty() @IsUUID("4") courseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class DailyScheduleDto {
  @ApiProperty() @IsUUID("4") courseId!: string;
  @ApiProperty() @Matches(DAY) date!: string;
  @ApiProperty() @IsString() @MaxLength(120) title!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  questionIds!: string[];
}

export class RescheduleDto {
  @ApiPropertyOptional() @IsOptional() @Matches(DAY) date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  questionIds?: string[];
}

export class QuizBatchesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  cohortIds!: string[];
}

export class DuplicateCheckDto {
  @ApiProperty() @IsString() @MaxLength(5000) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) imageUrl?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") courseId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") excludeId?: string | null;
}

export class QuestionImportQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") quizId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") courseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(["true", "false"]) dryRun?: string;
}

export class DryRunQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(["true", "false"]) dryRun?: string;
}

export class CreateReportDto {
  @ApiProperty() @IsUUID("4") studentId!: string;
  @ApiProperty({ enum: REPORT_KINDS }) @IsIn([...REPORT_KINDS]) kind!: ProgressReportKind;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) period?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) remarks?: string;
}

export class UpdateReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() refresh?: boolean;
}

export class ReportsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["DRAFT", "SUBMITTED", "APPROVED", "RETURNED"])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID("4") studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...REPORT_KINDS]) kind?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}(-\d{2})?$/) period?: string;
}

export class MonthDto {
  @ApiProperty() @Matches(MONTH, { message: "Use a month like 2026-11" }) month!: string;
}

export class DecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ShoutoutDto {
  @ApiProperty() @IsUUID("4") studentId!: string;
  @ApiProperty({ enum: SHOUTOUT_BADGES.map((b) => b.key) })
  @IsIn(SHOUTOUT_BADGES.map((b) => b.key))
  badge!: ShoutoutBadge;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class AnnouncementDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  cohortIds!: string[];
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(4000) body!: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true }) linkUrl?: string | null;
}

export class PublishRequestDto {
  @ApiProperty({ enum: REVIEWABLE_CONTENT_TYPES })
  @IsIn([...REVIEWABLE_CONTENT_TYPES])
  targetType!: ReviewableContentType;
  @ApiProperty() @IsUUID("4") targetId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class NewStudentDto {
  @ApiProperty() @IsUUID("4") cohortId!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(254) email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class StaffRequestsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(["PENDING", "APPROVED", "REJECTED"]) status?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["CONTENT_PUBLISH", "CONTENT_CHANGE", "NEW_STUDENT"])
  kind?: string;
}

export class RejectDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) note!: string;
}

export class PendingContentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  ids!: string[];
}
