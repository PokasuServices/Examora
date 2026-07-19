import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../dto/content-status-query.dto";

export class ListModulesQueryDto extends ContentListQueryDto {
  @ApiProperty({ description: "Owning topic id (required scope)" })
  @IsUUID("4")
  topicId!: string;
}
