import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../dto/content-status-query.dto";

export class ListLessonsQueryDto extends ContentListQueryDto {
  @ApiProperty({ description: "Owning module id (required scope)" })
  @IsUUID("4")
  moduleId!: string;
}
