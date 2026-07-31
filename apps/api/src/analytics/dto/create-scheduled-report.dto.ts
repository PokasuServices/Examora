import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import {
  REPORT_CADENCES,
  REPORT_FORMATS,
  REPORT_TYPES,
  type ReportCadence,
  type ReportFormat,
  type ReportType,
} from "@examora/types";

export class CreateScheduledReportDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @ApiProperty({ enum: REPORT_FORMATS })
  @IsIn(REPORT_FORMATS)
  format!: ReportFormat;

  @ApiProperty({ enum: REPORT_CADENCES })
  @IsIn(REPORT_CADENCES)
  cadence!: ReportCadence;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
