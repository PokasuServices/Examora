"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/cms/pages", label: "Pages" },
  { href: "/cms/faq", label: "FAQ" },
  { href: "/cms/announcements", label: "Announcements" },
  { href: "/cms/banners", label: "Banners" },
  { href: "/cms/media", label: "Media Library" },
];

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="border-b border-neutral-200 bg-white px-6">
        <div className="mx-auto flex max-w-6xl gap-1">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-3 py-3 text-sm font-medium ${
                  active
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
