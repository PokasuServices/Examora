import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { AuthenticatedUser, RoleName } from "@examora/types";
import type { AppConfig } from "../config/configuration";
// NOTE: constructor-injected classes must stay as VALUE imports — see TD-011.
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { PermissionsService } from "../permissions/permissions.service";
import { AuditService } from "../audit/audit.service";
import { MAILER_PORT, type MailerPort } from "../mailer/mailer.port";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { expiresAtFromNow, generateOpaqueToken, hashToken } from "./refresh-token.util";

type UserWithRoles = Awaited<ReturnType<UsersService["findByEmail"]>>;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

const EMAIL_VERIFICATION_EXPIRY = "24h";
const PASSWORD_RESET_EXPIRY = "1h";

/**
 * Sprint 1 authentication service (ADR-0006, ADR-0009, ADR-0010).
 * - Refresh rotates the token on every use (closes TD-008).
 * - Self-registration always assigns the STUDENT role; mentor/reviewer/admin
 *   accounts are provisioned by an administrator via /admin/users.
 * - Every sensitive action is audited (SEC-13 §7).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<IssuedTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.usersService.createWithDefaultRole({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      defaultRole: "STUDENT",
      consentVersion: dto.consentVersion,
      consentChannel: "web",
    });

    await this.prisma.consentRecord.create({
      data: {
        userId: user.id,
        type: "TERMS_OF_SERVICE",
        version: dto.consentVersion,
        channel: "web",
        granted: true,
      },
    });

    await this.sendEmailVerification(user.id, user.email);

    await this.auditService.record({
      actorId: user.id,
      action: "auth.registered",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, roles: ["STUDENT"] },
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });

    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<IssuedTokens> {
    const user = await this.usersService.findByEmail(dto.email);

    // Constant error message regardless of which check fails, so responses
    // never confirm whether an email is registered (FR-AUTH-01 acceptance criterion).
    if (!user || !user.passwordHash) {
      await this.auditService.record({
        actorId: null,
        action: "auth.login_failed",
        entityType: "User",
        after: { email: dto.email, reason: "no_such_account_or_password" },
        ipAddress: meta.ipAddress,
        correlationId: meta.correlationId,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.auditService.record({
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "User",
        entityId: user.id,
        after: { reason: "bad_password" },
        ipAddress: meta.ipAddress,
        correlationId: meta.correlationId,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    // Credentials are correct at this point, so telling the account owner
    // their own account is suspended/archived doesn't leak anything they
    // don't already know (ADMIN-08 §5 "User Suspension & Reactivation").
    if (user.status === "SUSPENDED" || user.status === "ARCHIVED") {
      await this.auditService.record({
        actorId: user.id,
        action: "auth.login_failed",
        entityType: "User",
        entityId: user.id,
        after: { reason: "account_status", status: user.status },
        ipAddress: meta.ipAddress,
        correlationId: meta.correlationId,
      });
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    await this.auditService.record({
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });

    return this.issueTokens(user, meta);
  }

  /** Rotates the refresh token on every use — old token is revoked immediately (closes TD-008). */
  async refresh(refreshTokenPlain: string, meta: RequestMeta): Promise<IssuedTokens> {
    const tokenHash = hashToken(refreshTokenPlain);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.usersService.findByIdWithRoles(stored.userId);
    if (!user || user.status === "SUSPENDED" || user.status === "ARCHIVED") {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user, meta);
  }

  async logout(refreshTokenPlain: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashToken(refreshTokenPlain);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      actorId: stored.userId,
      action: "auth.logout",
      entityType: "User",
      entityId: stored.userId,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByIdWithRoles(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toAuthenticatedUser(user);
  }

  // ---------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------

  async sendEmailVerification(userId: string, email: string): Promise<void> {
    const token = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        type: "EMAIL_VERIFICATION",
        expiresAt: expiresAtFromNow(EMAIL_VERIFICATION_EXPIRY),
      },
    });

    await this.mailer.send({
      to: email,
      subject: "Verify your Examora account",
      text: `Welcome to Examora. Verify your email using this token: ${token}`,
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    // Always resolve silently — never confirm whether an email is registered.
    if (!user || user.emailVerifiedAt) {
      return;
    }

    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: "EMAIL_VERIFICATION", usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.sendEmailVerification(user.id, user.email);
  }

  async verifyEmail(tokenPlain: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashToken(tokenPlain);
    const stored = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });

    if (
      !stored ||
      stored.type !== "EMAIL_VERIFICATION" ||
      stored.usedAt ||
      stored.expiresAt < new Date()
    ) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await this.prisma.verificationToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });

    await this.usersService.markEmailVerified(stored.userId);

    await this.auditService.record({
      actorId: stored.userId,
      action: "auth.email_verified",
      entityType: "User",
      entityId: stored.userId,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  // ---------------------------------------------------------------------
  // Forgot / reset password
  // ---------------------------------------------------------------------

  async forgotPassword(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    // Always resolve silently regardless of whether the account exists
    // (FR-AUTH-01 acceptance criterion: no account-enumerating responses).
    if (!user) {
      return;
    }

    const token = generateOpaqueToken();
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        type: "PASSWORD_RESET",
        expiresAt: expiresAtFromNow(PASSWORD_RESET_EXPIRY),
      },
    });

    await this.mailer.send({
      to: user.email,
      subject: "Reset your Examora password",
      text: `Reset your password using this token: ${token}. It expires in 1 hour.`,
    });

    await this.auditService.record({
      actorId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  async resetPassword(tokenPlain: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashToken(tokenPlain);
    const stored = await this.prisma.verificationToken.findUnique({ where: { tokenHash } });

    if (
      !stored ||
      stored.type !== "PASSWORD_RESET" ||
      stored.usedAt ||
      stored.expiresAt < new Date()
    ) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      // Invalidate every existing session — a password reset must not leave
      // old sessions (possibly the attacker's, possibly stale) usable.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      actorId: stored.userId,
      action: "auth.password_reset_completed",
      entityType: "User",
      entityId: stored.userId,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  // ---------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------

  async listSessions(userId: string, currentRefreshTokenPlain?: string): Promise<SessionSummary[]> {
    const currentHash = currentRefreshTokenPlain ? hashToken(currentRefreshTokenPlain) : undefined;

    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: currentHash !== undefined && session.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const session = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException("Session not found");
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      actorId: userId,
      action: "auth.session_revoked",
      entityType: "RefreshToken",
      entityId: sessionId,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  async revokeAllSessions(
    userId: string,
    meta: RequestMeta,
    exceptTokenPlain?: string,
  ): Promise<void> {
    const exceptHash = exceptTokenPlain ? hashToken(exceptTokenPlain) : undefined;

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      actorId: userId,
      action: "auth.all_sessions_revoked",
      entityType: "User",
      entityId: userId,
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });
  }

  // ---------------------------------------------------------------------
  // OAuth (Google)
  // ---------------------------------------------------------------------

  async loginWithOAuth(
    params: {
      provider: string;
      providerUserId: string;
      email: string;
      firstName?: string;
      lastName?: string;
    },
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    let user = await this.usersService.findByOAuthAccount(params.provider, params.providerUserId);

    if (!user) {
      const existingByEmail = await this.usersService.findByEmail(params.email);

      if (existingByEmail) {
        await this.usersService.linkOAuthAccount(
          existingByEmail.id,
          params.provider,
          params.providerUserId,
        );
        user = await this.usersService.findByIdWithRoles(existingByEmail.id);
      } else {
        user = await this.usersService.createFromOAuth({
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
          provider: params.provider,
          providerUserId: params.providerUserId,
          defaultRole: "STUDENT",
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException("Unable to authenticate with provider");
    }

    await this.auditService.record({
      actorId: user.id,
      action: "auth.oauth_login",
      entityType: "User",
      entityId: user.id,
      after: { provider: params.provider },
      ipAddress: meta.ipAddress,
      correlationId: meta.correlationId,
    });

    return this.issueTokens(user, meta);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async issueTokens(
    user: NonNullable<UserWithRoles>,
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    const { auth } = this.configService.getOrThrow<AppConfig>("app");

    const accessToken = await this.signAccessToken(user);
    const refreshToken = generateOpaqueToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: expiresAtFromNow(auth.refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken, user: await this.toAuthenticatedUser(user) };
  }

  private async signAccessToken(user: NonNullable<UserWithRoles>): Promise<string> {
    const { auth } = this.configService.getOrThrow<AppConfig>("app");
    const roles = user.roles.map((userRole) => userRole.role.name) as RoleName[];

    return this.jwtService.sign(
      { sub: user.id, email: user.email, roles },
      { secret: auth.accessSecret, expiresIn: auth.accessExpiresIn },
    );
  }

  private async toAuthenticatedUser(user: NonNullable<UserWithRoles>): Promise<AuthenticatedUser> {
    const roles = user.roles.map((userRole) => userRole.role.name) as RoleName[];
    const permissions = await this.permissionsService.getPermissionsForRoles(roles);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      roles,
      permissions,
    };
  }
}
