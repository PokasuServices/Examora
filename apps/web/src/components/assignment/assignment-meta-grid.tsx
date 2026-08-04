import { Award, FileUp } from "lucide-react";
import type { AssignmentDetail } from "@examora/types";
import { Card } from "@/components/ui/card";
import { DeadlineBadge } from "./deadline-badge";

export function AssignmentMetaGrid({ assignment }: { assignment: AssignmentDetail }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Award size={14} strokeWidth={1.75} aria-hidden="true" />
            Total marks
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">
            {assignment.marksTotal}
          </p>
        </div>
        <div>
          <div className="text-xs font-medium text-neutral-500">Deadline</div>
          <div className="mt-1.5">
            <DeadlineBadge deadline={assignment.deadline} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <FileUp size={14} strokeWidth={1.75} aria-hidden="true" />
            Files allowed
          </div>
          <p className="mt-1 font-heading text-xl font-bold text-neutral-900">
            {assignment.fileRules.maxFiles}
          </p>
          <p className="text-xs text-neutral-400">
            up to {assignment.fileRules.maxFileSizeMb}MB each
          </p>
        </div>
      </div>
    </Card>
  );
}
