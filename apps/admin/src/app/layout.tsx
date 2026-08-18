import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Shell } from "@/components/shell/shell";

// Same typefaces as apps/web (Inter body / Plus Jakarta Sans headings) —
// one product, one typographic voice.
const bodyFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Examora Admin",
  description: "Examora platform administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
