export interface AppConfig {
  nodeEnv: string;
  port: number;
  globalPrefix: string;
  corsOrigins: string[];
  webOrigin: string;
  database: { url: string };
  redis: { url: string };
  auth: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
    refreshCookieName: string;
  };
  oauth: {
    google: {
      configured: boolean;
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
}

/** Consumed via ConfigService.get<AppConfig>('app'). Values validated in env.validation.ts. */
export default (): { app: AppConfig } => {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";

  return {
    app: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      port: parseInt(process.env.API_PORT ?? "3001", 10),
      globalPrefix: process.env.API_GLOBAL_PREFIX ?? "api/v1",
      corsOrigins: (process.env.CORS_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      webOrigin: process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000",
      database: {
        url: process.env.DATABASE_URL ?? "",
      },
      redis: {
        url: process.env.REDIS_URL ?? "",
      },
      auth: {
        accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
        refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
        refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? "examora_refresh_token",
      },
      oauth: {
        google: {
          // ADR-0005: Google is the default OAuth provider, but real
          // credentials are not available in every environment. Routes stay
          // registered either way (see GoogleConfiguredGuard) so the app
          // never crashes at boot for missing OAuth config.
          configured: googleClientId.length > 0 && googleClientSecret.length > 0,
          clientId: googleClientId || "not-configured",
          clientSecret: googleClientSecret || "not-configured",
          callbackUrl:
            process.env.GOOGLE_OAUTH_CALLBACK_URL ??
            "http://localhost:3001/api/v1/auth/google/callback",
        },
      },
    },
  };
};
