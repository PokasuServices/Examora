import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs";
import { successResponse } from "@examora/shared";
import type { ApiSuccessResponse } from "@examora/types";

/**
 * Wraps every successful controller return value in the standard success
 * envelope (API-17 §5) so controllers just return plain data.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(map((data) => successResponse(data)));
  }
}
