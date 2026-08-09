import { AlertCircle, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ADMIN_LINKS } from "./admin-links";
import type { AdminCommunityAnalytics } from "@examora/types";
import type { CommunityReport } from "@examora/types";

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-neutral-900">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function CommunitySection({
  community,
  moderationQueue,
}: {
  community: AdminCommunityAnalytics | null;
  moderationQueue: CommunityReport[];
}) {
  if (!community) return null;

  return (
    <section aria-labelledby="community-heading">
      <h2 id="community-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Community overview
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <StatBlock label="Posts" value={community.totalThreads} />
            <StatBlock label="Replies" value={community.totalReplies} />
            <StatBlock label="Open reports" value={community.openReportsCount} />
            <StatBlock label="Moderation actions" value={community.moderationActionsCount} />
          </div>
          {community.acceptedAnswerRate !== null ? (
            <p className="mt-4 text-xs text-neutral-500">
              {Math.round(community.acceptedAnswerRate)}% of threads have an accepted answer.
            </p>
          ) : null}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle
                size={16}
                strokeWidth={1.75}
                className="text-warning-600"
                aria-hidden="true"
              />
              <h3 className="font-heading text-sm font-semibold text-neutral-900">
                Moderation queue
              </h3>
            </div>
            <a
              href={ADMIN_LINKS.moderation}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Open moderation →
            </a>
          </div>
          {moderationQueue.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              heading="Queue is clear"
              body="No pending reports right now."
            />
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {moderationQueue.map((report) => (
                <li key={report.id} className="py-2.5 text-sm">
                  <p className="font-medium text-neutral-800">
                    {report.targetType} reported by {report.reporterEmail}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">{report.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
