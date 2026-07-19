/**
 * Converts a title into a URL-safe slug: lowercase, spaces/underscores to
 * hyphens, non-alphanumerics stripped, collapsed and trimmed hyphens.
 * Used to derive content-node slugs when an explicit one isn't supplied (ADR-0012).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
