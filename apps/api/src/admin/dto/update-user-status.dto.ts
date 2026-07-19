import { ApiProperty } from "@nestjs/swagger";
import { USER_STATUSES, type UserStatus } from "@examora/types";
import { IsIn } from "class-validator";

export class UpdateUserStatusDto {
  @ApiProperty({ enum: USER_STATUSES })
  @IsIn(USER_STATUSES)
  status!: UserStatus;
}
