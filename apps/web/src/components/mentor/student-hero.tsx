import { Mail } from "lucide-react";
import type { Student360 } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ActivityBadge } from "./activity-badge";

export function StudentHero({ student360 }: { student360: Student360 }) {
  const { profile } = student360;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  const initials = (profile.firstName?.[0] ?? profile.email[0] ?? "?").toUpperCase();
  const lastActiveAt = student360.activityTimeline[0]?.occurredAt ?? null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 font-heading text-xl font-semibold text-primary-700">
            {initials}
          </span>
          <div>
            <h1 className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl">{name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
              <Mail size={14} strokeWidth={1.75} aria-hidden="true" />
              {profile.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={profile.status === "ACTIVE" ? "success" : "neutral"}>{profile.status}</Chip>
          <ActivityBadge lastActiveAt={lastActiveAt} />
        </div>
      </div>
    </Card>
  );
}
