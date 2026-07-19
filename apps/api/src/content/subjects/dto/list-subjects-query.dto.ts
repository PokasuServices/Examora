import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../dto/content-status-query.dto";

export class ListSubjectsQueryDto extends ContentListQueryDto {
  @ApiProperty({ description: "Owning course id (required scope)" })
  @IsUUID("4")
  courseId!: string;
}
