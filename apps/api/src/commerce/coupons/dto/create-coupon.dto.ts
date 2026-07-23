import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { COUPON_DISCOUNT_TYPES, type CouponDiscountType } from "@examora/types";

export class CreateCouponDto {
  @ApiProperty({ example: "WELCOME10" })
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9_-]+$/, { message: "code must be uppercase alphanumeric" })
  code!: string;

  @ApiProperty({ enum: COUPON_DISCOUNT_TYPES })
  @IsEnum(COUPON_DISCOUNT_TYPES)
  discountType!: CouponDiscountType;

  @ApiProperty({ description: "Percentage (0-100) or a fixed amount, per discountType" })
  @IsPositive()
  discountValue!: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxRedemptions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
