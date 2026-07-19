import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";

/**
 * Runs before AuthGuard('google') so an unconfigured deployment returns a
 * clear 503 instead of either crashing at boot (GoogleStrategy uses
 * placeholder credentials when unset — see TD-015) or redirecting to a
 * Google error page with a bogus client ID.
 */
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const { oauth } = this.configService.getOrThrow<AppConfig>("app");
    if (!oauth.google.configured) {
      throw new ServiceUnavailableException("Google OAuth is not configured on this deployment");
    }
    return true;
  }
}
