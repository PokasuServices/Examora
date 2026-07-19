import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks an endpoint as not requiring authentication. Every endpoint is
 * protected by default (SEC-13 §4 "server-side authorization for every API")
 * — this is the explicit, auditable opt-out, not the default.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
