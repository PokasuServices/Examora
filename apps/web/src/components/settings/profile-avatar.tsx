import { authorInitials } from "@/lib/format";

const SIZE_CLASSES = {
  md: "h-10 w-10 text-sm",
  xl: "h-16 w-16 text-xl",
} as const;

/**
 * No avatar/photo field exists on UserProfile — this is the "profile photo
 * placeholder" the brief asks for, not a real upload. Same soft-tint
 * initials pattern as the Community Avatar and the Header's AvatarMenu.
 */
export function ProfileAvatar({
  user,
  size = "md",
}: {
  user: { email: string; firstName: string | null; lastName: string | null };
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-heading font-semibold text-primary-700 ${SIZE_CLASSES[size]}`}
    >
      {authorInitials(user)}
    </span>
  );
}
