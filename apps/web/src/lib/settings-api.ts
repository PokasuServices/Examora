"use client";

import { useAuth } from "@examora/auth-client";
import type { ConsentType, UserProfile } from "@examora/types";

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianEmail?: string;
}

/** Typed wrappers over the caller's own /users/me, /auth/sessions and /auth password/verification endpoints. */
export function useSettingsApi() {
  const { request } = useAuth();

  return {
    getProfile: () => request<UserProfile>("/users/me", { method: "GET" }),
    updateProfile: (dto: UpdateProfilePayload) =>
      request<UserProfile>("/users/me", { method: "PUT", body: dto }),
    recordConsent: (dto: {
      type: ConsentType;
      version: string;
      channel: string;
      granted: boolean;
    }) => request<{ status: string }>("/users/me/consent", { method: "POST", body: dto }),

    listSessions: () => request<SessionSummary[]>("/auth/sessions", { method: "GET" }),
    revokeSession: (id: string) => request<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
    revokeAllSessions: () => request<void>("/auth/sessions", { method: "DELETE" }),

    requestPasswordReset: (email: string) =>
      request<void>("/auth/forgot-password", { method: "POST", body: { email } }),
    resendVerification: (email: string) =>
      request<void>("/auth/resend-verification", { method: "POST", body: { email } }),
  };
}
