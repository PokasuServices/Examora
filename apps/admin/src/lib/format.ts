/** "PENDING_VERIFICATION" -> "Pending verification". Shared across every status chip in the app. */
export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
