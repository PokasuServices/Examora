import { ApiProperty } from "@nestjs/swagger";
import { ROLE_NAMES, type RoleName } from "@examora/types";
import { ArrayMinSize, ArrayUnique, IsIn } from "class-validator";

export class AssignRolesDto {
  @ApiProperty({ enum: ROLE_NAMES, isArray: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ROLE_NAMES, { each: true })
  roles!: RoleName[];
}
