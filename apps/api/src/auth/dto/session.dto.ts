import { ApiProperty } from "@nestjs/swagger";

export class SessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  isCurrent!: boolean;
}
