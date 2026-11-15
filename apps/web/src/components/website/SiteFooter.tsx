import Link from "next/link";
import { AppLogo } from "@/components/common/AppLogo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#mentoring", label: "Mentoring" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/announcements", label: "Announcements" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/register", label: "Create account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-screen-xl gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
        <div>
          <AppLogo />
          <p className="mt-4 max-w-xs text-sm text-neutral-500">
            Exam preparation and mentoring — courses, practice, feedback and progress in one place.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold text-neutral-800">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-500 hover:text-primary-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-200">
        <p className="mx-auto max-w-screen-xl px-4 py-6 text-sm text-neutral-500 md:px-6">
          &copy; {new Date().getFullYear()} Examora. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
