import type { CSSProperties, ReactNode } from "react";

/**
 * What the reader's two views (continuous scroll, page turn) have in common,
 * so gestures, zoom, and navigation are written once in PDFViewport and
 * delegated here instead of duplicated per view.
 */
export type SurfaceHandle = {
  /** Pinch start. `focal` is the fingers' midpoint in client coordinates. */
  zoomBegin(focal: { x: number; y: number }): void;
  /** Live, GPU-only feedback while the fingers move — no re-render, no rasterization. */
  zoomPreview(ratio: number, dx: number, dy: number): void;
  /** Fingers lifted: ask for the real scale and keep the pinched point under the fingers once it renders. */
  zoomCommit(ratio: number, dx: number, dy: number): void;
  /** Animated zoom to an absolute scale about a client point (double-tap, presets). */
  zoomAnimateTo(scale: number, focal: { x: number; y: number }): void;
  /** Content is wider than the viewport: horizontal drags pan instead of turning pages. */
  overflowsX(): boolean;
  goToPage(page: number, offset?: number, smooth?: boolean): void;
};

export type RenderPage = (page: number, style: CSSProperties, deferMs: number) => ReactNode;

export type Anchor = { page: number; fx: number; fy: number };

/** Where (in scroll-content coordinates) a page's box sits. */
export type PageBox = { left: number; top: number; width: number; height: number };

/** Nearest page to a point — inside its box, or failing that the closest one. */
export function anchorAt(boxes: { page: number; box: PageBox }[], x: number, y: number): Anchor | null {
  let best: { page: number; box: PageBox; d: number } | null = null;
  for (const { page, box } of boxes) {
    const dx = x < box.left ? box.left - x : x > box.left + box.width ? x - (box.left + box.width) : 0;
    const dy = y < box.top ? box.top - y : y > box.top + box.height ? y - (box.top + box.height) : 0;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { page, box, d };
  }
  if (!best) return null;
  // Fractions may fall slightly outside 0-1 (margins, gaps); that's fine — the mapping stays linear.
  return { page: best.page, fx: (x - best.box.left) / best.box.width, fy: (y - best.box.top) / best.box.height };
}
