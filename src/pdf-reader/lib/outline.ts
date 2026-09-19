import type { OutlineNode } from "@/pdf-reader/types";

/** The deepest heading at or before `page` — "what chapter am I in", for the scrubber and header. */
export function chapterFor(outline: OutlineNode[], page: number): string | null {
  let best: { title: string; page: number } | null = null;
  const walk = (nodes: OutlineNode[]) => {
    for (const n of nodes) {
      if (n.page !== null && n.page <= page && (!best || n.page >= best.page)) best = { title: n.title, page: n.page };
      walk(n.children);
    }
  };
  walk(outline);
  return (best as { title: string } | null)?.title ?? null;
}
