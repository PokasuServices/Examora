import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { MENTOR_TASK_STATUSES, type MentorTaskStatus } from "@examora/types";
import { IsIn, IsOptional } from "class-validator";
import { CreateTaskDto } from "./create-task.dto";

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: MENTOR_TASK_STATUSES })
  @IsOptional()
  @IsIn(MENTOR_TASK_STATUSES)
  status?: MentorTaskStatus;
}
