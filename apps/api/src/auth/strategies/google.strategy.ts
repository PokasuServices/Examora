import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import type { AppConfig } from "../../config/configuration";

export interface GoogleOAuthProfile {
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Registered unconditionally so the app never fails to boot over missing
 * OAuth credentials (ADR-0005) — placeholder values are used when
 * unconfigured, and GoogleConfiguredGuard blocks the routes before this
 * strategy would ever run with them. See TD-015.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(configService: ConfigService) {
    const { oauth } = configService.getOrThrow<AppConfig>("app");
    super({
      clientID: oauth.google.clientId,
      clientSecret: oauth.google.clientSecret,
      callbackURL: oauth.google.callbackUrl,
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error("Google profile did not include an email address"), false);
      return;
    }

    const result: GoogleOAuthProfile = {
      providerUserId: profile.id,
      email,
      firstName: profile.name?.givenName,
      lastName: profile.name?.familyName,
    };
    done(null, result);
  }
}
