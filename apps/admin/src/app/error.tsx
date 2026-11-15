"use client";

import { ErrorPage } from "@/components/common/ErrorPage";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      code="500"
      message="Something went wrong on our end. Please try again."
      onRetry={reset}
    />
  );
}
