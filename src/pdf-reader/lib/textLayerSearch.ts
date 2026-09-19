import type { TextLayer } from "pdfjs-dist";
import type { Rect } from "@/pdf-reader/types";

// Locates search-query matches inside an already-rendered pdf.js TextLayer
// and returns their on-screen rects as fractions of the container, using the
// same DOM Range technique as ordinary text selection (see PdfPage's
// mouseup handler) so highlighting lines up exactly with the rendered glyphs
// — pdf.js text items don't map 1:1 onto words, so matching against raw
// strings and then re-deriving a Range is more reliable than guessing
// per-span boundaries.
/** One entry per match (a match may span multiple lines/rects). */
export function findMatchRects(
  textLayer: TextLayer,
  container: HTMLElement,
  query: string,
  options: { caseSensitive: boolean; wholeWord: boolean }
): Rect[][] {
  if (!query.trim()) return [];
  const divs = textLayer.textDivs;
  const strs = textLayer.textContentItemsStr;
  if (divs.length !== strs.length) return [];

  // textContentItemsStr items are the same strings usePdfSearch joins with a
  // single space to build page-level text, so offsets computed the same way
  // line up with the search index.
  let cumulative = "";
  const starts: number[] = [];
  for (const s of strs) {
    starts.push(cumulative.length);
    cumulative += s + " ";
  }

  const flags = options.caseSensitive ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;
  const re = new RegExp(pattern, flags);

  const containerRect = container.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) return [];

  const groups: Rect[][] = [];
  for (const m of cumulative.matchAll(re)) {
    const matchStart = m.index ?? 0;
    const matchEnd = matchStart + m[0].length;

    let startDiv = -1;
    let endDiv = -1;
    for (let i = 0; i < starts.length; i++) {
      const spanStart = starts[i];
      const spanEnd = spanStart + strs[i].length;
      if (startDiv === -1 && matchEnd > spanStart && matchStart < spanEnd) startDiv = i;
      if (matchEnd > spanStart && matchStart < spanEnd) endDiv = i;
    }
    if (startDiv === -1 || endDiv === -1) continue;

    try {
      const range = document.createRange();
      const startNode = divs[startDiv].firstChild ?? divs[startDiv];
      const endNode = divs[endDiv].firstChild ?? divs[endDiv];
      const startOffset = Math.max(0, matchStart - starts[startDiv]);
      const endOffset = Math.min(strs[endDiv].length, matchEnd - starts[endDiv]);
      range.setStart(startNode, Math.min(startOffset, startNode.textContent?.length ?? 0));
      range.setEnd(endNode, Math.min(endOffset, endNode.textContent?.length ?? 0));

      const rects: Rect[] = [];
      for (const r of Array.from(range.getClientRects())) {
        if (r.width <= 0 || r.height <= 0) continue;
        rects.push({
          x: (r.left - containerRect.left) / containerRect.width,
          y: (r.top - containerRect.top) / containerRect.height,
          w: r.width / containerRect.width,
          h: r.height / containerRect.height,
        });
      }
      if (rects.length) groups.push(rects);
    } catch {
      // A boundary that doesn't map cleanly onto text nodes (rare, e.g.
      // ligature splits) just skips highlighting that one match.
    }
  }
  return groups;
}
