import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

/** Reorders a content collection (FR-CONTENT-01 "reorder nodes"). */
export class ReorderDto {
  @ApiProperty({
    type: [String],
    description: "Ordered list of ids; index becomes the new position",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  orderedIds!: string[];
}
