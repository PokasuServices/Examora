import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateCmsBannerDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Pass null to remove a previously-set image",
  })
  @IsOptional()
  @IsUUID()
  imageAssetId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiProperty({ description: 'e.g. "HOMEPAGE_TOP", "DASHBOARD_SIDEBAR"' })
  @IsString()
  placement!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
