import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";

// Design system typefaces (Student Dashboard spec, 2026-08-01): Plus Jakarta
// Sans for headings, Inter for body/UI text. Self-hosted via next/font — no
// external font-CDN request at runtime.
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Examora",
  description: "Exam preparation and mentoring platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT may add `dark` before hydration.
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
