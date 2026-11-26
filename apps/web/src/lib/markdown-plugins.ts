import type { Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/** Minimal mdast shape this file touches (avoids a direct mdast dependency). */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string };
}

/**
 * Inline marks plain Markdown doesn't have, used by the discussion toolbar
 * and available to lesson/explanation authors:
 *   ++underline++   ==highlight==   H~2~O (subscript)   x^2^ (superscript)
 * The opening mark must be followed, and the closing one preceded, by a
 * non-space, so "C++ and C++" stays plain text.
 */
const INLINE_MARK = /(\+\+|==)(?=\S)([\s\S]*?\S)\1|~([^~\s]+)~|\^([^^\s]+)\^/g;

function splitText(value: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(INLINE_MARK)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", value: value.slice(last, at) });
    const [, pair, paired, sub, sup] = m;
    const tag = pair === "++" ? "u" : pair === "==" ? "mark" : sub !== undefined ? "sub" : "sup";
    const inner = paired ?? sub ?? sup ?? "";
    out.push({
      type: "inlineMark",
      data: { hName: tag },
      children: [{ type: "text", value: inner }],
    });
    last = at + m[0].length;
  }
  if (out.length === 0) return [{ type: "text", value }];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function remarkInlineMarks() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text" && child.value) return splitText(child.value);
      walk(child);
      return [child];
    });
  };
  return (tree: MdNode) => walk(tree);
}

/**
 * Shared Markdown setup for lessons, official explanations and discussion
 * posts: GFM (tables, ~~strikethrough~~), formulas between $$ … $$ (KaTeX),
 * and the inline marks above. Single "$" is left as text so prices like
 * "$5 and $10" never turn into maths. KaTeX runs untrusted (no \href or
 * HTML commands) and shows bad formulas in red instead of failing.
 */
export const remarkPlugins: Options["remarkPlugins"] = [
  [remarkGfm, { singleTilde: false }],
  [remarkMath, { singleDollarTextMath: false }],
  remarkInlineMarks,
];

export const rehypePlugins: Options["rehypePlugins"] = [
  [rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }],
];
