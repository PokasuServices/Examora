import { SiteFooter } from "@/components/website/SiteFooter";
import { SiteHeader } from "@/components/website/SiteHeader";

/**
 * Public product website — home, announcements, FAQ and CMS pages. Kept
 * separate from the signed-in product, which lives in the (app) route
 * group with the TMS AdminLayout; website-only components live in
 * components/website/.
 */
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
