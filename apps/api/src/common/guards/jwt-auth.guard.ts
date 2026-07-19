import type { ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
// NOTE: Reflector is constructor-injected — must stay a VALUE import, see TD-011.
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Default guard, applied globally in AppModule. Every endpoint requires a
 * valid access token unless explicitly marked @Public() — RBAC coverage must
 * default to "deny" (SEC-13 §4), not rely on each controller opting in.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
