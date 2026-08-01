import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleConfiguredGuard } from "./guards/google-configured.guard";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    // No default secret/expiry here — AuthService signs each token explicitly
    // with the configured secret (see ADR-0006), so the module needs no
    // async ConfigService factory.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GoogleConfiguredGuard],
  // No other module imports AuthModule — nothing outside auth/ needs
  // AuthService directly (every cross-cutting concern it touches, e.g.
  // audit logging, goes through its own @Global() module instead).
})
export class AuthModule {}
