import type { ApiErrorResponse, ApiSuccessResponse } from "@examora/types";

/** Builds a success envelope matching API-17 §5. */
export function successResponse<T>(data: T, message = "OK"): ApiSuccessResponse<T> {
  return { success: true, data, message };
}

/** Builds an error envelope matching API-17 §5. */
export function errorResponse(
  code: string,
  message: string,
  correlationId: string,
  details?: unknown,
): ApiErrorResponse {
  return { success: false, error: { code, message, details }, correlationId };
}
