export type ReplyTreeNode<T> = T & { children: Array<ReplyTreeNode<T>> };

/**
 * Builds a nested reply tree from a flat, thread-scoped list (ADR-0017).
 * Whole-thread fetch + in-memory grouping, not a recursive Prisma query —
 * reply counts per thread are small enough that this is simpler and cheaper
 * than paginating each nesting level separately.
 */
export function buildReplyTree<T extends { id: string; parentReplyId: string | null }>(
  rows: T[],
): Array<ReplyTreeNode<T>> {
  const byId = new Map<string, ReplyTreeNode<T>>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  );
  const roots: Array<ReplyTreeNode<T>> = [];

  for (const node of byId.values()) {
    if (node.parentReplyId && byId.has(node.parentReplyId)) {
      byId.get(node.parentReplyId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
