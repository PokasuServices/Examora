import Link from "next/link";
import type { UserProfile } from "@examora/types";
import { Chip } from "@/components/ui/chip";
import { statusLabel } from "@/components/orders/format";
import { roleLabel } from "@/components/settings/format";
import { ProfileAvatar } from "@/components/settings/profile-avatar";
import { authorDisplayName } from "@/lib/format";
import { userStatusTone } from "./format";

export function UserTable({ users }: { users: UserProfile[] }) {
  return (
    <div className="overflow-x-auto contain-layout">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              User
            </th>
            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Role
            </th>
            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Status
            </th>
            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Created
            </th>
            <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProfileAvatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-800">
                      {authorDisplayName(user)}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                {user.roles.length > 0 ? user.roles.map(roleLabel).join(", ") : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Chip tone={userStatusTone(user.status)}>{statusLabel(user.status)}</Chip>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="text-sm font-medium text-primary-600 hover:underline"
                >
                  View details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
