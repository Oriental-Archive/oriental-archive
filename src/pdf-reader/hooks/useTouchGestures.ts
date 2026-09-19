import { useEffect, type RefObject } from "react";

export type Point2 = { x: number; y: number };

export type TouchGestureHandlers = {
  /** Two fingers down. `focal` is the midpoint in client coordinates. */
  pinchStart?: (focal: Point2) => void;
  /** `ratio` is current finger distance / starting distance; dx/dy is how far the midpoint has moved (two-finger pan). */
  pinchMove?: (p: { ratio: number; dx: number; dy: number }) => void;
  pinchEnd?: (p: { ratio: number; dx: number; dy: number }) => void;
  /** A clearly-horizontal one-finger drag that should turn pages. */
  swipeStart?: () => void;
  swipeMove?: (dx: number) => void;
  /** `vx` is px/ms at release (positive = moving right). `cancelled` when the system took the touch away. */
  swipeEnd?: (e: { dx: number; vx: number; cancelled: boolean }) => void;
  tap?: (e: { x: number; y: number; target: EventTarget | null }) => void;
  doubleTap?: (e: { x: number; y: number; target: EventTarget | null }) => void;
  /**
   * How long to wait before firing a tap. Taps that could be the first half
   * of a double-tap (zoom) must wait to find out; taps with no double-tap
   * meaning (page-turn edge zones) fire instantly so navigation never lags.
   */
  tapDelay?: (e: { x: number; y: number }) => number;
  /** Horizontal drags may turn the page (page-turn layout, not zoomed past the viewport width). */
  canSwipe?: () => boolean;
  /** A tool that owns finger movement is active (draw/area/note): don't interpret touches as gestures — except pinch. */
  blocked?: () => boolean;
};

// Thresholds are deliberately conservative: a page turn is a big, obvious
// motion, so a few pixels of finger drift while reading never triggers one.
const SLOP = 10; // px of travel before we decide what the gesture is
const TAP_MAX_MS = 280;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 36;
const HORIZONTAL_BIAS = 1.4; // |dx| must beat |dy| by this factor to count as a swipe

const INTERACTIVE =
  "[data-no-gesture], button, a, input, textarea, select, [role='slider'], [data-selection-toolbar], [data-annotation-mark]";

function hasSelection(): boolean {
  const s = window.getSelection();
  return !!s && !s.isCollapsed && s.toString().length > 0;
}

function distance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function midpoint(a: Touch, b: Touch): Point2 {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

type Mode = "idle" | "maybe" | "swipe" | "native" | "pinch" | "ignore";

/**
 * One place that decides what a touch *means*, so competing gestures can't
 * fight: pinch beats everything; a swipe only engages when the drag is clearly
 * horizontal AND the page can't pan horizontally AND no selection/tool is
 * active; anything else is left to the browser (native scroll/selection).
 * Handlers are read from a ref, so callers can pass fresh closures each render
 * without re-binding native listeners mid-gesture.
 */
export function useTouchGestures(elRef: RefObject<HTMLElement | null>, handlersRef: RefObject<TouchGestureHandlers>) {
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let mode: Mode = "idle";
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let dx = 0;
    let selectionAtStart = false;
    let samples: { x: number; t: number }[] = [];
    let pinchStartDist = 1;
    let pinchStartFocal: Point2 = { x: 0, y: 0 };
    let pinch = { ratio: 1, dx: 0, dy: 0 };
    let lastTap: { t: number; x: number; y: number } | null = null;
    let tapTimer: ReturnType<typeof setTimeout> | null = null;

    const h = () => handlersRef.current ?? {};

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length >= 2) {
        if (tapTimer) clearTimeout(tapTimer);
        if (mode === "swipe") h().swipeEnd?.({ dx, vx: 0, cancelled: true });
        const [a, b] = [e.touches[0], e.touches[1]];
        mode = "pinch";
        pinchStartDist = Math.max(1, distance(a, b));
        pinchStartFocal = midpoint(a, b);
        pinch = { ratio: 1, dx: 0, dy: 0 };
        h().pinchStart?.(pinchStartFocal);
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (mode === "pinch" || mode === "ignore") return;

      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = performance.now();
      dx = 0;
      samples = [{ x: startX, t: startT }];
      selectionAtStart = hasSelection();
      const onInteractive = !!(e.target as Element | null)?.closest?.(INTERACTIVE);
      mode = onInteractive || h().blocked?.() ? "native" : "maybe";
    }

    function onTouchMove(e: TouchEvent) {
      if (mode === "pinch" && e.touches.length >= 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const focal = midpoint(a, b);
        pinch = {
          ratio: distance(a, b) / pinchStartDist,
          dx: focal.x - pinchStartFocal.x,
          dy: focal.y - pinchStartFocal.y,
        };
        h().pinchMove?.(pinch);
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      if (mode === "maybe") {
        const mx = t.clientX - startX;
        const my = t.clientY - startY;
        if (Math.hypot(mx, my) < SLOP) return;
        const horizontal = Math.abs(mx) > Math.abs(my) * HORIZONTAL_BIAS;
        if (horizontal && h().canSwipe?.() && !selectionAtStart && !hasSelection()) {
          mode = "swipe";
          h().swipeStart?.();
        } else {
          mode = "native"; // vertical scroll / pan / selection-handle drag: not ours
        }
      }

      if (mode === "swipe") {
        if (e.cancelable) e.preventDefault();
        dx = t.clientX - startX;
        const now = performance.now();
        samples.push({ x: t.clientX, t: now });
        // Velocity over the last ~100ms, so a fast flick that slows at the end doesn't average away.
        while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
        h().swipeMove?.(dx);
      }
    }

    function finishSwipe(cancelled: boolean) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const span = last && first ? Math.max(1, last.t - first.t) : 1;
      const vx = last && first ? (last.x - first.x) / span : 0;
      h().swipeEnd?.({ dx, vx: cancelled ? 0 : vx, cancelled });
    }

    function onTouchEnd(e: TouchEvent) {
      if (mode === "pinch") {
        if (e.touches.length < 2) {
          h().pinchEnd?.(pinch);
          mode = e.touches.length === 0 ? "idle" : "ignore";
        }
        return;
      }
      if (mode === "ignore") {
        if (e.touches.length === 0) mode = "idle";
        return;
      }
      if (mode === "swipe") {
        finishSwipe(false);
        mode = "idle";
        return;
      }
      if (mode === "maybe") {
        const t = e.changedTouches[0];
        const moved = Math.hypot(t.clientX - startX, t.clientY - startY);
        const quick = performance.now() - startT <= TAP_MAX_MS;
        if (quick && moved <= SLOP && !selectionAtStart) registerTap(t.clientX, t.clientY, e.target);
      }
      mode = "idle";
    }

    function onTouchCancel() {
      if (mode === "swipe") finishSwipe(true);
      if (mode === "pinch") h().pinchEnd?.(pinch);
      mode = "idle";
    }

    function registerTap(x: number, y: number, target: EventTarget | null) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_DIST) {
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = null;
        lastTap = null;
        h().doubleTap?.({ x, y, target });
        return;
      }
      const delay = h().tapDelay?.({ x, y }) ?? 0;
      if (delay <= 0) {
        lastTap = null; // an instant tap can't be half of a double-tap
        h().tap?.({ x, y, target });
        return;
      }
      lastTap = { t: now, x, y };
      tapTimer = setTimeout(() => {
        tapTimer = null;
        lastTap = null;
        h().tap?.({ x, y, target });
      }, delay);
    }

    // Safari fires its own pinch events and zooms the whole page unless told not to.
    const stopGesture = (e: Event) => e.preventDefault();

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    el.addEventListener("gesturestart", stopGesture);
    el.addEventListener("gesturechange", stopGesture);
    return () => {
      if (tapTimer) clearTimeout(tapTimer);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("gesturestart", stopGesture);
      el.removeEventListener("gesturechange", stopGesture);
    };
  }, [elRef, handlersRef]);
}
