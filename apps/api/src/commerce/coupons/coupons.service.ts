import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateCouponDto } from "./dto/create-coupon.dto";
import type { UpdateCouponDto } from "./dto/update-coupon.dto";

/** Applies to a single order at checkout time (ADR-0018) — no cart/bundle model yet. */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto, actorId: string) {
    const clash = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (clash) {
      throw new ConflictException(`A coupon with code "${dto.code}" already exists`);
    }
    if (dto.discountType === "PERCENTAGE" && dto.discountValue > 100) {
      throw new BadRequestException("A percentage discount cannot exceed 100");
    }

    return this.prisma.coupon.create({
      data: {
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxRedemptions: dto.maxRedemptions,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        createdById: actorId,
      },
    });
  }

  async list(params: { page: number; pageSize: number; isActive?: boolean }) {
    const where = { ...(params.isActive === undefined ? {} : { isActive: params.isActive }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.findByIdOrThrow(id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxRedemptions: dto.maxRedemptions,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  /** Validates a coupon against a subtotal and returns the discount to apply — does not redeem it. */
  async validateForCheckout(code: string, subtotal: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException("Invalid coupon code");
    }
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      throw new BadRequestException("This coupon is not yet valid");
    }
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException("This coupon has expired");
    }
    if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new BadRequestException("This coupon has been fully redeemed");
    }

    const discount =
      coupon.discountType === "PERCENTAGE"
        ? (subtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    return { coupon, discountAmount: Math.min(discount, subtotal) };
  }

  /** Only counts once an order backed by this coupon actually reaches PAID (ADR-0018). */
  async recordRedemption(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }
}
