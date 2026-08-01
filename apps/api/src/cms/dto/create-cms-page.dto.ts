import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { CMS_PAGE_TYPES, type CmsPageType } from "@examora/types";

export class CreateCmsPageDto {
  @ApiProperty({ enum: CMS_PAGE_TYPES })
  @IsIn(CMS_PAGE_TYPES)
  pageType!: CmsPageType;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "slug must be lowercase letters, numbers, and hyphens only" })
  @MaxLength(200)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;
}
