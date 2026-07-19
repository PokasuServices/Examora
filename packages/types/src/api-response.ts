/**
 * Standard API envelope per API-17 §5. All apps/api responses conform to one
 * of these two shapes; apps/web and apps/admin should type their fetch layer
 * against this rather than re-declaring it.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
