import { Injectable } from "@nestjs/common";
import type { ConsentType, RoleName, UserStatus } from "@examora/types";
// NOTE: PrismaService is constructor-injected — must stay a VALUE import, see TD-011.
import { PrismaService } from "../prisma/prisma.service";

const USER_WITH_ROLES_INCLUDE = { roles: { include: { role: true } } } as const;

/** Identity-layer user access: auth, profile (FR-PROFILE-01), admin user management. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  findByIdWithRoles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  findByOAuthAccount(provider: string, providerUserId: string) {
    return this.prisma.user.findFirst({
      where: { oauthAccounts: { some: { provider, providerUserId } } },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  async createWithDefaultRole(params: {
    email: string;
    passwordHash?: string;
    firstName?: string;
    lastName?: string;
    defaultRole: RoleName;
    consentVersion?: string;
    consentChannel?: string;
  }) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { name: params.defaultRole },
    });

    return this.prisma.user.create({
      data: {
        email: params.email,
        passwordHash: params.passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
        // Status defaults to PENDING_VERIFICATION (schema default) — email
        // verification is what promotes it to ACTIVE. Resolves TD-009.
        consentVersion: params.consentVersion,
        consentChannel: params.consentChannel,
        consentedAt: params.consentVersion ? new Date() : undefined,
        roles: { create: { roleId: role.id } },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  /**
   * Creates a user from a verified OAuth profile. OAuth-originated accounts
   * skip email verification — the provider already verified the address.
   */
  async createFromOAuth(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    provider: string;
    providerUserId: string;
    defaultRole: RoleName;
  }) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { name: params.defaultRole },
    });

    return this.prisma.user.create({
      data: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: role.id } },
        oauthAccounts: {
          create: { provider: params.provider, providerUserId: params.providerUserId },
        },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  linkOAuthAccount(userId: string, provider: string, providerUserId: string) {
    return this.prisma.oAuthAccount.create({
      data: { userId, provider, providerUserId },
    });
  }

  markEmailVerified(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", emailVerifiedAt: new Date() },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  updatePasswordHash(userId: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      guardianName?: string;
      guardianEmail?: string;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        guardianName: data.guardianName,
        guardianEmail: data.guardianEmail,
      },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  recordConsent(
    userId: string,
    data: { type: ConsentType; version: string; channel: string; granted: boolean },
  ) {
    return this.prisma.consentRecord.create({
      data: {
        userId,
        type: data.type,
        version: data.version,
        channel: data.channel,
        granted: data.granted,
      },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    // Suspending/archiving an account must also kill its live sessions —
    // otherwise an already-issued refresh token keeps working regardless.
    if (status === "SUSPENDED" || status === "ARCHIVED") {
      const [updated] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { status },
          include: USER_WITH_ROLES_INCLUDE,
        }),
        this.prisma.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      return updated;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  async setRoles(userId: string, roles: RoleName[]) {
    const roleRows = await this.prisma.role.findMany({ where: { name: { in: roles } } });

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({
        data: roleRows.map((role) => ({ userId, roleId: role.id })),
      }),
    ]);

    return this.findByIdWithRoles(userId);
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: USER_WITH_ROLES_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
    ]);

    return { items, total };
  }
}
