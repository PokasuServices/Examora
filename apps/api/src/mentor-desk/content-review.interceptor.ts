import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Request } from "express";
import { from, switchMap, type Observable } from "rxjs";
import { SENT_FOR_REVIEW, type ReviewableContentType } from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { StaffScopeService } from "../staff/staff-scope.service";
import { StaffRequestsService } from "./staff-requests.service";

export const REVIEWABLE_KEY = "staff:reviewable";

/**
 * Marks an update/status route of fixed content. For a mentor, an edit to a
 * PUBLISHED record (or publishing a past paper) becomes a request for an
 * administrator instead of changing what students see.
 */
export const ReviewableContent = (type: ReviewableContentType, mode: "update" | "status") =>
  SetMetadata(REVIEWABLE_KEY, { type, mode });

@Injectable()
export class ContentReviewInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly scope: StaffScopeService,
    private readonly requests: StaffRequestsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<
      { type: ReviewableContentType; mode: "update" | "status" } | undefined
    >(REVIEWABLE_KEY, context.getHandler());
    if (!meta) return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user || !this.scope.isScoped(user)) return next.handle();
    return from(this.check(context, request, user, meta)).pipe(switchMap(() => next.handle()));
  }

  private async check(
    context: ExecutionContext,
    request: Request,
    user: RequestUser,
    meta: { type: ReviewableContentType; mode: "update" | "status" },
  ): Promise<void> {
    const id = String(request.params.id ?? "");
    const current = await this.requests.current(meta.type, id);
    if (!current) return; // the handler answers 404
    const body = (request.body ?? {}) as Record<string, unknown>;
    const isQuiz = meta.type === "quiz";
    const fixed = !isQuiz || this.requests.isFixedQuiz(current);
    if (!fixed) return;

    if (meta.mode === "status") {
      if (body.status !== "PUBLISHED") return;
      await this.requests.requestPublish(user, meta.type, id);
      throw new ConflictException({
        error: SENT_FOR_REVIEW,
        message: "Sent to an administrator to publish. You'll be notified when it's live.",
      });
    }
    if (current.status !== "PUBLISHED") return; // drafts are the mentor's to edit

    const patch = await this.validated(context, body);
    if (Object.keys(patch).length === 0) return;
    await this.requests.requestChange(user, meta.type, id, patch);
    throw new ConflictException({
      error: SENT_FOR_REVIEW,
      message:
        "Saved as a change request. Students keep seeing the current version until an administrator approves it.",
    });
  }

  /** Validates the body against the route's own DTO and keeps only its fields. */
  private async validated(context: ExecutionContext, body: Record<string, unknown>) {
    const types = (Reflect.getMetadata(
      "design:paramtypes",
      context.getClass().prototype,
      context.getHandler().name,
    ) ?? []) as (new () => object)[];
    const Dto = types.find((t) => typeof t === "function" && /Dto$/.test(t.name));
    if (!Dto) return {};
    const instance = plainToInstance(Dto, body);
    const errors = await validate(instance, { whitelist: true });
    if (errors.length) {
      const first = errors[0]!;
      throw new BadRequestException(
        Object.values(first.constraints ?? {})[0] ?? "Check the fields",
      );
    }
    return Object.fromEntries(Object.entries(instance).filter(([, v]) => v !== undefined));
  }
}
