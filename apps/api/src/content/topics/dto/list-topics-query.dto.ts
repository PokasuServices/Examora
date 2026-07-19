import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../dto/content-status-query.dto";

export class ListTopicsQueryDto extends ContentListQueryDto {
  @ApiProperty({ description: "Owning subject id (required scope)" })
  @IsUUID("4")
  subjectId!: string;
}
