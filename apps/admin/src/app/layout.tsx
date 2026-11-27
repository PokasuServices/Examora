import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { Providers } from "./providers";

// Same typefaces as apps/web (Inter body / Plus Jakarta Sans headings) —
// one product, one typographic voice. The heading font is self-hosted (Latin,
// variable 500–700, OFL): Google now serves it from URLs Turbopack in
// Next 15.1 can't load, which broke every staff page in dev.
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "500 700",
  display: "swap",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Examora Admin",
  description: "Examora platform administration",
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
      {/* Browser extensions (e.g. ColorZilla, Grammarly) add attributes to <body> before React
          hydrates; ignore those attribute differences here. Children are still checked. */}
      <body
        suppressHydrationWarning
        className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-300"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
