import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import ms from "ms";
import type { AuthenticatedUser } from "@examora/types";
import type { AppConfig } from "../config/configuration";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
// NOTE: AuthService and every DTO bound with @Body()/@Param() must stay VALUE
// imports, not `import type` — see TD-011.
import { AuthService } from "./auth.service";
import type { AuthResponseDto } from "./dto/auth-response.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import type { SessionDto } from "./dto/session.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { GoogleConfiguredGuard } from "./guards/google-configured.guard";
import type { GoogleOAuthProfile } from "./strategies/google.strategy";
import type { RequestMeta } from "./auth.service";
import type { RequestUser } from "./types/request-user";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Create a new account (self-registration; STUDENT role only)" })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto, this.requestMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate with email and password" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, this.requestMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate the refresh cookie and issue a new access token" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.readRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const result = await this.authService.refresh(refreshToken, this.requestMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke the current refresh token and clear the session cookie" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = this.readRefreshCookie(req);
    if (refreshToken) {
      await this.authService.logout(refreshToken, this.requestMeta(req));
    }
    res.clearCookie(this.cookieName(), { path: "/" });
  }

  @Get("me")
  @ApiOperation({ summary: "Current authenticated user" })
  me(@CurrentUser() user: RequestUser): Promise<AuthenticatedUser> {
    if (!user) {
      throw new ConflictException("Unexpected missing authenticated user");
    }
    return this.authService.me(user.id);
  }

  // ---------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify an account's email address using a one-time token" })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request): Promise<{ status: string }> {
    await this.authService.verifyEmail(dto.token, this.requestMeta(req));
    return { status: "verified" };
  }

  @Public()
  @Post("resend-verification")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Resend the email verification link (no-op if already verified)" })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    await this.authService.resendVerification(dto.email);
  }

  // ---------------------------------------------------------------------
  // Forgot / reset password
  // ---------------------------------------------------------------------

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Request a password-reset email (always returns 204)" })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request): Promise<void> {
    await this.authService.forgotPassword(dto.email, this.requestMeta(req));
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete a password reset using a one-time token" })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword, this.requestMeta(req));
    return { status: "reset" };
  }

  // ---------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------

  @Get("sessions")
  @ApiOperation({ summary: "List active sessions (non-revoked, non-expired refresh tokens)" })
  listSessions(@CurrentUser() user: RequestUser, @Req() req: Request): Promise<SessionDto[]> {
    const currentToken = this.readRefreshCookie(req);
    return this.authService.listSessions(user.id, currentToken);
  }

  @Delete("sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a specific session by id" })
  async revokeSession(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.revokeSession(user.id, id, this.requestMeta(req));
  }

  @Delete("sessions")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke every session except the current one" })
  async revokeAllSessions(@CurrentUser() user: RequestUser, @Req() req: Request): Promise<void> {
    const currentToken = this.readRefreshCookie(req);
    await this.authService.revokeAllSessions(user.id, this.requestMeta(req), currentToken);
  }

  // ---------------------------------------------------------------------
  // OAuth (Google)
  // ---------------------------------------------------------------------

  @Public()
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  @Get("google")
  @ApiOperation({ summary: "Start the Google OAuth flow (redirects to Google)" })
  googleLogin(): void {
    // Guard performs the redirect; handler body never runs.
  }

  @Public()
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  @Get("google/callback")
  @ApiOperation({ summary: "Google OAuth callback — completes login and redirects to the web app" })
  async googleCallback(
    @Req() req: Request & { user: GoogleOAuthProfile },
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.loginWithOAuth(
      {
        provider: "google",
        providerUserId: req.user.providerUserId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      this.requestMeta(req),
    );

    this.setRefreshCookie(res, result.refreshToken);

    const { webOrigin } = this.configService.getOrThrow<AppConfig>("app");
    const redirectUrl = new URL("/auth/callback", webOrigin);
    redirectUrl.searchParams.set("accessToken", result.accessToken);
    res.redirect(redirectUrl.toString());
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private cookieName(): string {
    return this.configService.getOrThrow<AppConfig>("app").auth.refreshCookieName;
  }

  private readRefreshCookie(req: Request): string | undefined {
    return req.cookies?.[this.cookieName()] as string | undefined;
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const { nodeEnv, auth } = this.configService.getOrThrow<AppConfig>("app");
    res.cookie(auth.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: nodeEnv === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ms(auth.refreshExpiresIn),
    });
  }

  private requestMeta(req: Request): RequestMeta {
    return {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      correlationId: req.headers["x-correlation-id"] as string | undefined,
    };
  }
}
