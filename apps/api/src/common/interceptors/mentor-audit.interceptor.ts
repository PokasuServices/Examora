import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { tap, type Observable } from "rxjs";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Routine actions that aren't staff changes (signing in, reading markers, the user's own learning). */
const SKIP = [
  "/auth/",
  "/notifications",
  "/student-dashboards/",
  "/assignment-catalog/dashboard/seen",
  "/daily-quiz/",
  "/quiz-attempts",
  "/learn/",
];

/**
 * Mentors have near-admin rights (mentor module, MF0), so every successful
 * change a mentor makes is audited: who, which route, which record and which
 * fields were sent (field names only, never values).
 */
@Injectable()
export class MentorAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MentorAuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    const isMentor =
      user?.roles.includes("MENTOR") === true && !user.roles.includes("ADMINISTRATOR");
    if (!isMentor || !WRITES.has(req.method) || SKIP.some((s) => req.originalUrl.includes(s))) {
      return next.handle();
    }
    const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const params = req.params ?? {};
    const entityId =
      params.id ?? Object.values(params).find((v) => /^[0-9a-f-]{36}$/i.test(String(v))) ?? null;
    const fields =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? Object.keys(req.body as Record<string, unknown>)
        : [];
    return next.handle().pipe(
      tap(() => {
        void this.audit
          .record({
            actorId: user!.id,
            action: `mentor.${req.method.toLowerCase()}`,
            entityType: route,
            entityId: entityId ? String(entityId) : null,
            after: { fields },
            ipAddress: req.ip,
            correlationId: req.headers["x-correlation-id"] as string | undefined,
          })
          .catch((err: unknown) =>
            this.logger.warn(`Couldn't audit mentor change: ${String(err)}`),
          );
      }),
    );
  }
}
