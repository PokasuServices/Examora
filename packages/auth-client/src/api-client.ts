export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  baseUrl: string;
  accessToken?: string | null;
  body?: unknown;
}

/**
 * Thin fetch wrapper matching the API-17 §5 response envelope. Every call
 * sends cookies (the refresh token) and, when provided, a bearer access
 * token — used by AuthProvider and any page/component that needs a custom
 * authenticated request.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const { baseUrl, accessToken, body, headers, ...rest } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.error?.message ?? response.statusText,
      response.status,
      payload?.error?.code,
      payload?.error?.details,
    );
  }

  return (payload?.data ?? null) as T;
}
