"use client";

import * as React from "react";
import { RequirePermission } from "@/components/require-permission";
import { ApprovalsContent } from "@/components/approvals";

export default function ApprovalsPage() {
  return (
    <RequirePermission permission="deletion:request">
      <React.Suspense fallback={null}>
        <ApprovalsContent />
      </React.Suspense>
    </RequirePermission>
  );
}
