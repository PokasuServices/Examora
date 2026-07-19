"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@examora/auth-client";

function OAuthCallbackContent() {
  const router = useRouter();
  const { completeOAuthCallback } = useAuth();
  const accessToken = useSearchParams().get("accessToken");

  React.useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    completeOAuthCallback(accessToken)
      .then(() => router.replace("/"))
      .catch(() => router.replace("/login"));
    // Only re-run if the token itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-600">Signing you in…</p>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <React.Suspense fallback={null}>
      <OAuthCallbackContent />
    </React.Suspense>
  );
}
