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

/** Renders the first PUBLISHED HOMEPAGE_TOP banner, if any (ADR-0022 §2, §5). */
export async function HomepageBanner() {
  const banner = await fetchTopBanner();
  if (!banner) return null;

  const content = (
    <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
      <span className="text-sm font-medium text-primary-800">{banner.title}</span>
    </div>
  );

  if (banner.linkUrl) {
    return (
      <a href={banner.linkUrl} className="block">
        {content}
      </a>
    );
  }
  return content;
}
