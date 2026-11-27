import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { RequestUser } from "../auth/types/request-user";
import { SCOPED_KEY, type ScopedRule } from "./scoped.decorator";
import { STAFF_SCOPE_REQUEST_KEY } from "./scope-where";
import { StaffScopeService } from "./staff-scope.service";

/**
 * Enforces @Scoped(...) for mentors (after PermissionsGuard). Method-level
 * rules are added to class-level ones. Administrators pass untouched.
 * Also stores the caller's scope on the request for @ActorScope().
 */
@Injectable()
export class StaffScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scope: StaffScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    const scope = user ? await this.scope.scopeFor(user) : null;
    (request as unknown as Record<string, unknown>)[STAFF_SCOPE_REQUEST_KEY] = scope;

    const rules = [
      ...(this.reflector.get<ScopedRule[]>(SCOPED_KEY, context.getClass()) ?? []),
      ...(this.reflector.get<ScopedRule[]>(SCOPED_KEY, context.getHandler()) ?? []),
    ];
    if (rules.length === 0 || !scope) return true;

    for (const rule of rules) {
      const source = (request[rule.from] ?? {}) as Record<string, unknown>;
      const raw = source[rule.key];
      const values = (Array.isArray(raw) ? raw : [raw]).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      for (const value of values) {
        if (!(await this.scope.allows(scope, rule.kind, value))) {
          throw new NotFoundException("Not found");
        }
      }
    }
    return true;
  }
}
