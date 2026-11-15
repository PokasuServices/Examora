import { Megaphone } from "lucide-react";
import type { CmsBannerDto } from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function fetchTopBanner(): Promise<CmsBannerDto | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/cms/banners?placement=HOMEPAGE_TOP`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const banners = (payload?.data ?? []) as CmsBannerDto[];
    return banners[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Renders the first PUBLISHED HOMEPAGE_TOP banner, if any (ADR-0022 §2, §5),
 * styled as a pill on the hero's brand panel. Managed from Admin › CMS › Banners.
 */
export async function HomepageBanner() {
  const banner = await fetchTopBanner();
  if (!banner) return null;

  const content = (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white">
      <Megaphone size={16} strokeWidth={1.75} aria-hidden="true" />
      {banner.title}
    </span>
  );

  if (banner.linkUrl) {
    return (
      <div className="mb-6">
        <a href={banner.linkUrl} className="inline-block hover:opacity-90">
          {content}
        </a>
      </div>
    );
  }
  return <div className="mb-6">{content}</div>;
}
