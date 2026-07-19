"use client";

import * as React from "react";
import type { AuthenticatedUser } from "@examora/types";
import { apiRequest, type ApiRequestOptions } from "./api-client";

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  consentVersion: string;
  acceptTerms: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  accessToken: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
  completeOAuthCallback: (accessToken: string) => Promise<void>;
  /** Authenticated request helper, pre-bound to the current base URL + access token. */
  request: <T>(
    path: string,
    options?: Omit<ApiRequestOptions, "baseUrl" | "accessToken">,
  ) => Promise<T>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * Session bootstrap: on mount, silently exchanges the HttpOnly refresh
 * cookie for a fresh access token (ADR-0006) so a page reload doesn't force
 * a re-login. Shared by apps/web and apps/admin — see ADR-0011.
 */
export function AuthProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}): React.ReactElement {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);

  const fetchMe = React.useCallback(
    async (token: string) => {
      const me = await apiRequest<AuthenticatedUser>("/auth/me", {
        baseUrl,
        method: "GET",
        accessToken: token,
      });
      setUser(me);
    },
    [baseUrl],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      try {
        const result = await apiRequest<{ accessToken: string }>("/auth/refresh", {
          baseUrl,
          method: "POST",
        });
        if (cancelled) return;
        setAccessToken(result.accessToken);
        await fetchMe(result.accessToken);
        if (!cancelled) setStatus("authenticated");
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, fetchMe]);

  const login = React.useCallback(
    async (payload: LoginPayload) => {
      const result = await apiRequest<{ accessToken: string; user: AuthenticatedUser }>(
        "/auth/login",
        { baseUrl, method: "POST", body: payload },
      );
      setAccessToken(result.accessToken);
      setUser(result.user);
      setStatus("authenticated");
    },
    [baseUrl],
  );

  const register = React.useCallback(
    async (payload: RegisterPayload) => {
      const result = await apiRequest<{ accessToken: string; user: AuthenticatedUser }>(
        "/auth/register",
        { baseUrl, method: "POST", body: payload },
      );
      setAccessToken(result.accessToken);
      setUser(result.user);
      setStatus("authenticated");
    },
    [baseUrl],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { baseUrl, method: "POST", accessToken });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [baseUrl, accessToken]);

  const refetchUser = React.useCallback(async () => {
    if (!accessToken) return;
    await fetchMe(accessToken);
  }, [accessToken, fetchMe]);

  /** Completes the Google OAuth redirect (the refresh cookie is already set by the callback). */
  const completeOAuthCallback = React.useCallback(
    async (token: string) => {
      setAccessToken(token);
      await fetchMe(token);
      setStatus("authenticated");
    },
    [fetchMe],
  );

  const requestFn = React.useCallback(
    <T,>(path: string, options: Omit<ApiRequestOptions, "baseUrl" | "accessToken"> = {}) =>
      apiRequest<T>(path, { ...options, baseUrl, accessToken }),
    [baseUrl, accessToken],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      login,
      register,
      logout,
      refetchUser,
      completeOAuthCallback,
      request: requestFn,
    }),
    [
      status,
      user,
      accessToken,
      login,
      register,
      logout,
      refetchUser,
      completeOAuthCallback,
      requestFn,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
