"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingPanel } from "@/components/student/load-panels";

/** Old "Review answers" link: answers now live in the report's "My answers" tab. */
export default function ReviewRedirect() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  React.useEffect(() => {
    router.replace(`/quizzes/attempts/${attemptId}/result?tab=answers`);
  }, [attemptId, router]);
  return <LoadingPanel />;
}
