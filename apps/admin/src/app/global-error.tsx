"use client";

import "./globals.css";

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
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-heading">Something went wrong</h1>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
