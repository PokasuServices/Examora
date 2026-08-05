"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Superseded by the "Bookmarked" tab on My Discussions — this route now just forwards there so old links still work. */
export default function BookmarksRedirectPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/community/me");
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-neutral-500">Redirecting…</p>
    </main>
  );
}
