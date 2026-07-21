import { Type, plainToInstance } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MinLength, validateSync } from "class-validator";

enum NodeEnv {
  Development = "development",
  Test = "test",
  Production = "production",
}

/**
 * Fails fast on boot if required configuration is missing or malformed, rather
 * than failing confusingly later at first use (MDG-00 §12 secrets/config discipline).
 */
class EnvironmentVariables {
  @IsIn([NodeEnv.Development, NodeEnv.Test, NodeEnv.Production])
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  API_PORT = 3001;

  @IsString()
  API_GLOBAL_PREFIX = "api/v1";

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  @MinLength(32, { message: "JWT_ACCESS_SECRET must be at least 32 characters" })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN = "15m";

  @IsString()
  @MinLength(32, { message: "JWT_REFRESH_SECRET must be at least 32 characters" })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN = "30d";

  @IsString()
  REFRESH_COOKIE_NAME = "examora_refresh_token";

  @IsOptional()
  @IsString()
  CORS_ORIGINS = "";

  @IsOptional()
  @IsString()
  NEXT_PUBLIC_WEB_ORIGIN?: string;

  // Google OAuth (ADR-0005) — optional: the app must boot without real
  // credentials (see GoogleConfiguredGuard for the runtime-facing behavior).
  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CALLBACK_URL?: string;

  // Object storage (ADR-0005, ADR-0015) — S3-compatible, MinIO locally.
  @IsString()
  S3_ENDPOINT!: string;

  @IsString()
  S3_REGION = "us-east-1";

  @IsString()
  S3_ACCESS_KEY_ID!: string;

  @IsString()
  S3_SECRET_ACCESS_KEY!: string;

  @IsString()
  S3_BUCKET!: string;

  @IsOptional()
  @IsString()
  S3_FORCE_PATH_STYLE = "true";

  // Malware scanning (ADR-0005, ADR-0015, TD-005).
  @IsString()
  CLAMAV_HOST = "localhost";

  @Type(() => Number)
  @IsInt()
  CLAMAV_PORT = 3310;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(", "))
      .join("; ");
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validated;
}
