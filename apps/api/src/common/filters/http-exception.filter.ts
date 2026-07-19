import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { errorResponse } from "@examora/shared";

/**
 * Central exception handler (DEV-23 §7, MDG-00 §11). Every error leaving the
 * API conforms to the standard envelope from API-17 §5 and carries the
 * request's correlation ID (set by CorrelationIdMiddleware) — never a raw
 * stack trace or internal message in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request.headers["x-correlation-id"] as string) ?? "unknown";

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const { code, message, details } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse(code, message, correlationId, details));
  }

  private resolve(exception: unknown): { code: string; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null) {
        const { message, error } = body as { message?: unknown; error?: unknown };
        return {
          code: (error as string) ?? exception.name,
          message: Array.isArray(message)
            ? message.join("; ")
            : ((message as string) ?? exception.message),
          details: Array.isArray(message) ? message : undefined,
        };
      }
      return { code: exception.name, message: exception.message };
    }

    return { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" };
  }
}
