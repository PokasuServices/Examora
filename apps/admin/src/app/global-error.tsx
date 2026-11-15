"use client";

import "./globals.css";
import { ErrorPage } from "@/components/common/ErrorPage";

// Next.js requires global-error.tsx to render its own <html>/<body> — it
// replaces the root layout entirely when an error escapes the root layout
// itself (the one case app/error.tsx cannot catch).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <ErrorPage
          code="500"
          message="Something went wrong on our end. Please try again."
          onRetry={reset}
        />
      </body>
    </html>
  );
}
