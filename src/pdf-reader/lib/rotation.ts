import type { Point, Rect } from "@/pdf-reader/types";

// Annotation rects/points are stored canonically at rotation 0, unflipped —
// anchored to the page itself, not to whatever orientation was on screen
// when they were drawn — so rotating or flipping the page later doesn't
// leave them pointing at the wrong spot. These convert between that
// canonical space and the current view; capture sites canonicalize on the
// way in, AnnotationLayer projects back to view space on the way out.
//
// View = rotate(canonical) then, if flipped, mirror top/bottom. Undoing it
// runs the same steps in reverse: un-mirror first, then un-rotate.

function rotatePointCW(p: Point): Point {
  return { x: 1 - p.y, y: p.x };
}

function rotateRectCW(r: Rect): Rect {
  return { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w };
}

function flipPointV(p: Point): Point {
  return { x: p.x, y: 1 - p.y };
}

function flipRectV(r: Rect): Rect {
  return { x: r.x, y: 1 - r.y - r.h, w: r.w, h: r.h };
}

function steps(rotation: 0 | 90 | 180 | 270): number {
  return rotation / 90;
}

export function toViewPoint(p: Point, rotation: 0 | 90 | 180 | 270, flipVertical = false): Point {
  let result = p;
  for (let i = 0; i < steps(rotation); i++) result = rotatePointCW(result);
  if (flipVertical) result = flipPointV(result);
  return result;
}

export function toCanonicalPoint(p: Point, rotation: 0 | 90 | 180 | 270, flipVertical = false): Point {
  let result = flipVertical ? flipPointV(p) : p;
  for (let i = 0; i < (4 - steps(rotation)) % 4; i++) result = rotatePointCW(result);
  return result;
}

export function toViewRect(r: Rect, rotation: 0 | 90 | 180 | 270, flipVertical = false): Rect {
  let result = r;
  for (let i = 0; i < steps(rotation); i++) result = rotateRectCW(result);
  if (flipVertical) result = flipRectV(result);
  return result;
}

export function toCanonicalRect(r: Rect, rotation: 0 | 90 | 180 | 270, flipVertical = false): Rect {
  let result = flipVertical ? flipRectV(r) : r;
  for (let i = 0; i < (4 - steps(rotation)) % 4; i++) result = rotateRectCW(result);
  return result;
}

export type Side = "top" | "right" | "bottom" | "left";

const BOTTOM_AFTER_ROTATION: Record<0 | 90 | 180 | 270, Side> = {
  0: "bottom",
  90: "left",
  180: "top",
  270: "right",
};

const OPPOSITE_SIDE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * A mark drawn along "the bottom of the text" (an underline, or the
 * mid-line of a strikethrough) is only visually correct if that edge
 * rotates and flips along with the rect it's drawn on — a border-bottom
 * doesn't turn into a border-left on its own just because the box hosting
 * it did. This says which CSS side "canonical bottom" ends up on for the
 * current view, so the caller can put the border there instead.
 */
export function canonicalBottomSide(rotation: 0 | 90 | 180 | 270, flipVertical: boolean): Side {
  const side = BOTTOM_AFTER_ROTATION[rotation];
  // A vertical flip mirrors top/bottom only — left/right are untouched.
  if (flipVertical && (side === "top" || side === "bottom")) return OPPOSITE_SIDE[side];
  return side;
}
