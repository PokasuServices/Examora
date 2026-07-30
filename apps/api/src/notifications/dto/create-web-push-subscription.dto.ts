import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUrl, MaxLength } from "class-validator";

export class CreateWebPushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  endpoint!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  auth!: string;
}
