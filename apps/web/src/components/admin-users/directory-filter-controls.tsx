import { SelectField } from "@/components/ui/select-field";
import type { RoleFilter, StatusFilter } from "./use-user-directory";

const ROLE_OPTIONS = [
  { value: "ALL", label: "All roles" },
  { value: "STUDENT", label: "Student" },
  { value: "MENTOR", label: "Mentor" },
  { value: "REVIEWER", label: "Reviewer" },
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "GUARDIAN", label: "Guardian" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING_VERIFICATION", label: "Pending verification" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ARCHIVED", label: "Archived" },
];

export function DirectoryFilterControls({
  roleFilter,
  onRoleChange,
  statusFilter,
  onStatusChange,
}: {
  roleFilter: RoleFilter;
  onRoleChange: (value: RoleFilter) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SelectField
        id="user-role-filter"
        label="Role"
        value={roleFilter}
        options={ROLE_OPTIONS}
        onChange={(v) => onRoleChange(v as RoleFilter)}
      />
      <SelectField
        id="user-status-filter"
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onChange={(v) => onStatusChange(v as StatusFilter)}
      />
    </div>
  );
}
