import { Injectable } from "@nestjs/common";
// NOTE: ConfigService is constructor-injected — must stay a VALUE import, see TD-011.
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AppConfig } from "../../config/configuration";
import type { RequestUser } from "../types/request-user";

interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: RequestUser["roles"];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    const { auth } = configService.getOrThrow<AppConfig>("app");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.accessSecret,
    });
  }

  validate(payload: AccessTokenPayload): RequestUser {
    return { id: payload.sub, email: payload.email, roles: payload.roles };
  }
}
