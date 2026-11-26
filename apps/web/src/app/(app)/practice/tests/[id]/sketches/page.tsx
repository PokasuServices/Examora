"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LoadingPanel } from "@/components/student/load-panels";

/** Old "Sketch workspace" link: sketching now lives in the paper's Part B tab. */
export default function SketchWorkspaceRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  React.useEffect(() => {
    router.replace(`/practice/tests/${id}?part=b`);
  }, [id, router]);
  return <LoadingPanel />;
}
