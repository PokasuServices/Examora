import type { ChipTone } from "@/components/ui/chip";
import { Chip } from "@/components/ui/chip";
import { ACTIVITY_BUCKET_LABEL, activityBucket } from "./activity-status";

const TONE: Record<ReturnType<typeof activityBucket>, ChipTone> = {
  active: "success",
  "check-in": "warning",
  "at-risk": "danger",
  "never-started": "neutral",
};

export function ActivityBadge({ lastActiveAt }: { lastActiveAt: string | null }) {
  const bucket = activityBucket(lastActiveAt);
  return <Chip tone={TONE[bucket]}>{ACTIVITY_BUCKET_LABEL[bucket]}</Chip>;
}
