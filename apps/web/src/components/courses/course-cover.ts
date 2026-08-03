// No cover-image field exists on Course anywhere in the schema — a
// deterministic color wash per course id/title, not a stock photo. Shared
// between the dashboard's rail CourseCard and the catalog's grid card so the
// same course always renders the same wash in both places.
const COVER_WASHES = [
  "from-primary-500 to-primary-700",
  "from-accent-400 to-accent-600",
  "from-success-400 to-success-600",
  "from-warning-400 to-warning-600",
  "from-purple-400 to-purple-600",
  "from-pink-400 to-pink-600",
];

export function courseCoverWash(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COVER_WASHES[hash % COVER_WASHES.length]!;
}
