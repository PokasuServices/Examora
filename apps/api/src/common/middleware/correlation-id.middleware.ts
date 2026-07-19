import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { generateCorrelationId } from "@examora/utils";
import { HEADER_CORRELATION_ID } from "@examora/shared";

/**
 * Ensures every request has a correlation ID: reuses the caller-supplied
 * X-Correlation-ID (API-17 §4) if present, otherwise generates one, and
 * reflects it back on the response for client-side log correlation.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers["x-correlation-id"];
    const correlationId =
      (Array.isArray(existing) ? existing[0] : existing) ?? generateCorrelationId();

    req.headers["x-correlation-id"] = correlationId;
    res.setHeader(HEADER_CORRELATION_ID, correlationId);
    next();
  }
}
