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
  storage: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
  };
  malwareScanner: {
    host: string;
    port: number;
  };
  payments: {
    razorpay: {
      configured: boolean;
      keyId: string;
      keySecret: string;
      webhookSecret: string;
    };
  };
  notifications: {
    ses: {
      configured: boolean;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      fromEmail: string;
    };
    twilio: {
      configured: boolean;
      accountSid: string;
      authToken: string;
      smsFrom: string;
      whatsappFrom: string;
    };
    webPush: {
      configured: boolean;
      publicKey: string;
      privateKey: string;
      subject: string;
    };
  };
}

/** Consumed via ConfigService.get<AppConfig>('app'). Values validated in env.validation.ts. */
export default (): { app: AppConfig } => {
  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "";
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const sesAccessKeyId = process.env.SES_ACCESS_KEY_ID ?? "";
  const sesSecretAccessKey = process.env.SES_SECRET_ACCESS_KEY ?? "";
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN ?? "";
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

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
      storage: {
        endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
        region: process.env.S3_REGION ?? "us-east-1",
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        bucket: process.env.S3_BUCKET ?? "examora-uploads",
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
      },
      malwareScanner: {
        host: process.env.CLAMAV_HOST ?? "localhost",
        port: parseInt(process.env.CLAMAV_PORT ?? "3310", 10),
      },
      payments: {
        razorpay: {
          // ADR-0005/0018: Razorpay is the default gateway, but real
          // credentials are not available in every environment — the port/
          // adapter split (mirroring StoragePort/MalwareScannerPort) means the
          // app boots and the fake adapter serves all automated tests either way.
          configured: razorpayKeyId.length > 0 && razorpayKeySecret.length > 0,
          keyId: razorpayKeyId,
          keySecret: razorpayKeySecret,
          webhookSecret: razorpayWebhookSecret,
        },
      },
      notifications: {
        // ADR-0019 §6: every channel adapter logs instead of sending when
        // unconfigured (unlike payments, no money is on the line), so the app
        // boots and the whole delivery pipeline is exercisable in tests with
        // zero real vendor credentials.
        ses: {
          configured: sesAccessKeyId.length > 0 && sesSecretAccessKey.length > 0,
          region: process.env.SES_REGION ?? "us-east-1",
          accessKeyId: sesAccessKeyId,
          secretAccessKey: sesSecretAccessKey,
          fromEmail: process.env.SES_FROM_EMAIL ?? "no-reply@examora.test",
        },
        twilio: {
          configured: twilioAccountSid.length > 0 && twilioAuthToken.length > 0,
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken,
          smsFrom: process.env.TWILIO_SMS_FROM ?? "",
          whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
        },
        webPush: {
          configured: vapidPublicKey.length > 0 && vapidPrivateKey.length > 0,
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey,
          subject: process.env.VAPID_SUBJECT ?? "mailto:admin@examora.test",
        },
      },
    },
  };
};
