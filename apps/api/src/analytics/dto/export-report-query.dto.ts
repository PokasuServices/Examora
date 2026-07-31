import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { REPORT_FORMATS, type ReportFormat } from "@examora/types";
import { RunReportQueryDto } from "./run-report-query.dto";

export class ExportReportQueryDto extends RunReportQueryDto {
  @ApiProperty({ enum: REPORT_FORMATS })
  @IsIn(REPORT_FORMATS)
  format!: ReportFormat;
}
