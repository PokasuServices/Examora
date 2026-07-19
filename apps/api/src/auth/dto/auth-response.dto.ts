import { ApiProperty } from "@nestjs/swagger";
import type { AuthenticatedUser } from "@examora/types";

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: AuthenticatedUser;
}
