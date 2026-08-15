"use client";

import Link from "next/link";
import { Bell, FileText, Image as ImageIcon, MonitorPlay } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { RetryInline } from "@/components/ui/retry-inline";
import { CmsShell } from "@/components/admin-cms/cms-shell";
import { useCmsOverview, type CmsTypeCounts } from "@/components/admin-cms/use-cms-overview";

function TypeCard({
  icon: Icon,
  label,
  href,
  counts,
}: {
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>;
  label: string;
  href: string;
  counts: CmsTypeCounts;
}) {
  return (
    <Link href={href} className="block">
      <Card interactive>
        <div className="flex items-center gap-2">
          <Icon size={18} strokeWidth={1.75} className="text-primary-600" aria-hidden={true} />
          <h3 className="font-heading text-sm font-semibold text-neutral-900">{label}</h3>
        </div>
        <p className="mt-3 font-heading text-2xl font-bold text-neutral-900">{counts.total}</p>
        <p className="mt-1 text-xs text-neutral-500">{counts.published} published</p>
      </Card>
    </Link>
  );
}

function CmsOverviewContent() {
  const { status, pages, faq, announcements, banners, mediaTotal, retry } = useCmsOverview();

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load CMS statistics" onRetry={retry} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        A snapshot of every content-workflow surface — click through to manage each one.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <TypeCard icon={FileText} label="Pages" href="/admin/cms/pages" counts={pages} />
        <TypeCard icon={MonitorPlay} label="FAQ" href="/admin/cms/faq" counts={faq} />
        <TypeCard
          icon={Bell}
          label="Announcements"
          href="/admin/cms/announcements"
          counts={announcements}
        />
        <TypeCard icon={ImageIcon} label="Banners" href="/admin/cms/banners" counts={banners} />
        <Link href="/admin/cms/media" className="block">
          <Card interactive>
            <div className="flex items-center gap-2">
              <ImageIcon
                size={18}
                strokeWidth={1.75}
                className="text-primary-600"
                aria-hidden={true}
              />
              <h3 className="font-heading text-sm font-semibold text-neutral-900">Media</h3>
            </div>
            <p className="mt-3 font-heading text-2xl font-bold text-neutral-900">{mediaTotal}</p>
            <p className="mt-1 text-xs text-neutral-500">assets uploaded</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function CmsOverviewPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsShell>
        <CmsOverviewContent />
      </CmsShell>
    </RequirePermission>
  );
}
