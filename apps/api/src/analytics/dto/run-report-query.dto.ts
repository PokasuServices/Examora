import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { REPORT_TYPES, type ReportType } from "@examora/types";

export class RunReportQueryDto {
  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @ApiPropertyOptional({ description: "ISO date — inclusive lower bound where applicable" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "ISO date — inclusive upper bound where applicable" })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}
