import type { Request } from "express";

export interface RequestAuditMeta {
  ipAddress?: string;
  correlationId?: string;
}

/** Pulls IP + correlation id off a request for audit records (SEC-13 §7). */
export function requestAuditMeta(req: Request): RequestAuditMeta {
  return {
    ipAddress: req.ip,
    correlationId: req.headers["x-correlation-id"] as string | undefined,
  };
}
