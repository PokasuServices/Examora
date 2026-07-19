/** Mirrors the `consent_type` enum in database/prisma/schema.prisma. */
export const CONSENT_TYPES = [
  "TERMS_OF_SERVICE",
  "PRIVACY_POLICY",
  "MARKETING",
  "GUARDIAN_COMMUNICATION",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentRecordSummary {
  type: ConsentType;
  version: string;
  channel: string;
  granted: boolean;
  createdAt: string;
}
