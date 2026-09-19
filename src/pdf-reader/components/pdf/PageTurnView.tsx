import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { useNaturalSizes } from "@/pdf-reader/hooks/usePageLayout";
import { clampScale } from "@/pdf-reader/hooks/useFitScale";
import { anchorAt, type Anchor, type RenderPage, type SurfaceHandle } from "@/pdf-reader/components/pdf/surface";
import type { PageAnimation } from "@/pdf-reader/types";

/** Groups pages into what's shown at once: a single page, or book-style spreads (cover alone, then 2-3, 4-5, …). */
export type Units = {
  count: number;
  unitOf: (page: number) => number;
  pages: (unit: number) => number[];
};

export function makeUnits(numPages: number, spread: boolean): Units {
  if (!spread) return { count: numPages, unitOf: (p) => p, pages: (u) => (u >= 1 && u <= numPages ? [u] : []) };
  return {
    count: 1 + Math.ceil(Math.max(0, numPages - 1) / 2),
    unitOf: (p) => (p <= 1 ? 1 : Math.floor(p / 2) + 1),
    pages: (u) => (u === 1 ? [1] : [2 * u - 2, 2 * u - 1].filter((p) => p >= 1 && p <= numPages)),
  };
}

export type PageTurnHandle = SurfaceHandle & {
  turn: (delta: number) => void;
  swipeStart: () => void;
  swipeMove: (dx: number) => void;
  swipeEnd: (e: { dx: number; vx: number; cancelled: boolean }) => void;
};

type Props = {
  units: Units;
  currentPage: number;
  scale: number;
  natural: ReturnType<typeof useNaturalSizes>;
  padding: number;
  containerSize: { width: number; height: number };
  renderPage: RenderPage;
  onPageChange: (page: number) => void;
  onScaleRequest: (scale: number) => void;
  animation: PageAnimation;
  /** Vertical panning inside a tall page is the browser's; this adds horizontal panning when zoomed past the width. */
  baseTouchAction: string;
};

type PendingZoom = Anchor & { sx: number; sy: number };

// Fast enough to never feel like waiting, long enough to read as motion.
const MIN_MS = 150;
const MAX_MS = 300;
const COMMIT_DISTANCE = 0.2; // fraction of the width a drag must cover to turn
const COMMIT_VELOCITY = 0.45; // px/ms — a flick turns the page even from a short drag
const WINDOW = 2; // panes kept mounted on each side, so rapid successive turns never land on an empty pane

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const PageTurnView = forwardRef<PageTurnHandle, Props>(function PageTurnView(
  { units, currentPage, scale, natural, padding, containerSize, renderPage, onPageChange, onScaleRequest, animation, baseTouchAction },
  ref
) {
  const stripRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const contentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const currentUnit = units.unitOf(currentPage);
  const unitRef = useRef(currentUnit);
  const offsetRef = useRef(0);
  const animRef = useRef<{ raf: number; finish: () => void } | null>(null);
  const draggingRef = useRef(false);
  const pinchRef = useRef<{ fx: number; fy: number; lx: number; ly: number } | null>(null);
  const pendingZoomRef = useRef<PendingZoom | null>(null);
  const pendingZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFracRef = useRef({ fx: 0.5, fy: 0 });
  const prevScaleRef = useRef(scale);
  const [overflowX, setOverflowX] = useState(false);

  const width = containerSize.width;
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const widthRef = useRef(width);
  widthRef.current = width;

  const setOffset = useCallback((px: number) => {
    offsetRef.current = px;
    const strip = stripRef.current;
    if (strip) {
      strip.style.transform = px === 0 ? "" : `translate3d(${px}px, 0, 0)`;
      // Pane shadows only while turning; at rest a neighbor's shadow would bleed onto the current page's edge.
      strip.toggleAttribute("data-moving", px !== 0);
    }
  }, []);

  // Where each page of a unit sits inside its (scrollable) pane. Pages sit
  // side by side; the whole group is centered, and the pane grows past the
  // viewport when the group is bigger than it (zoomed in) so it can be panned.
  const unitGeometry = useCallback(
    (unit: number) => {
      const pages = unitsRef.current.pages(unit);
      const sizes = pages.map((p) => {
        const s = natural.getSize(p);
        return { page: p, width: s.width * scale, height: s.height * scale };
      });
      const totalW = sizes.reduce((sum, s) => sum + s.width, 0);
      const maxH = sizes.reduce((m, s) => Math.max(m, s.height), 0);
      const contentW = Math.max(containerSize.width, totalW + padding);
      const contentH = Math.max(containerSize.height, maxH + padding);
      let x = (contentW - totalW) / 2;
      const boxes = sizes.map((s) => {
        const box = { page: s.page, box: { left: x, top: (contentH - s.height) / 2, width: s.width, height: s.height } };
        x += s.width;
        return box;
      });
      return { boxes, contentW, contentH, totalW };
    },
    [natural, scale, padding, containerSize.width, containerSize.height]
  );
  const unitGeometryRef = useRef(unitGeometry);
  unitGeometryRef.current = unitGeometry;

  // Units committed but not yet reflected back through the currentPage prop.
  // Rapid taps commit several turns before React re-renders with the first
  // one; without this the stale prop would rewind unitRef and drop turns.
  const inflightRef = useRef<number[]>([]);
  // Where an animated turn that hasn't landed yet is headed, so a rapid second
  // tap turns *from there* instead of re-requesting the same page.
  const pendingTargetRef = useRef<number | null>(null);
  const commit = useCallback(
    (unit: number) => {
      unitRef.current = unit;
      inflightRef.current.push(unit);
      if (pendingTargetRef.current === unit) pendingTargetRef.current = null;
      const first = unitsRef.current.pages(unit)[0];
      if (first) onPageChange(first);
    },
    [onPageChange]
  );

  // Once the new current unit has rendered, put the strip back at rest in the
  // same frame — the target pane was already on screen, so nothing visibly jumps.
  useLayoutEffect(() => {
    const i = inflightRef.current.indexOf(currentUnit);
    if (i >= 0) inflightRef.current.splice(0, i + 1);
    else inflightRef.current = []; // navigated from outside (scrubber, TOC, search)
    if (inflightRef.current.length === 0) unitRef.current = currentUnit;
    setOffset(0);
    const strip = stripRef.current;
    if (strip) {
      strip.style.opacity = "";
      strip.style.transition = "";
    }
  }, [currentUnit, setOffset]);

  const currentPane = () => paneRefs.current.get(unitRef.current) ?? null;
  const currentContent = () => contentRefs.current.get(unitRef.current) ?? null;

  const finishNow = useCallback(() => {
    const a = animRef.current;
    if (a) {
      cancelAnimationFrame(a.raf);
      animRef.current = null;
      a.finish();
    }
  }, []);

  function runAnimation(from: number, to: number, ms: number, done: () => void) {
    const t0 = performance.now();
    const state = { raf: 0, finish: () => {} };
    let completed = false;
    state.finish = () => {
      if (completed) return;
      completed = true;
      setOffset(to);
      done();
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setOffset(from + (to - from) * easeOut(t));
      if (t < 1) state.raf = requestAnimationFrame(step);
      else {
        animRef.current = null;
        state.finish();
      }
    };
    animRef.current = state;
    state.raf = requestAnimationFrame(step);
  }

  const turnTo = useCallback(
    (target: number, from = 0, velocity = 0) => {
      finishNow();
      const u = unitsRef.current;
      const w = widthRef.current || 1;
      if (target < 1 || target > u.count || target === unitRef.current) {
        // Nothing to turn to (or already there): settle back to rest.
        if (offsetRef.current !== 0) runAnimation(offsetRef.current, 0, 180, () => {});
        return;
      }
      const dir = target > unitRef.current ? -1 : 1;
      if (animation === "off") {
        commit(target);
        return;
      }
      if (animation === "reduced") {
        pendingTargetRef.current = target;
        const strip = stripRef.current;
        if (strip) {
          strip.style.transition = "opacity 90ms linear";
          strip.style.opacity = "0";
        }
        window.setTimeout(() => commit(target), 90);
        return;
      }
      pendingTargetRef.current = target;
      const end = dir * w;
      const remaining = Math.abs(end - from);
      const speed = Math.max(Math.abs(velocity), 1.2);
      const ms = Math.min(MAX_MS, Math.max(MIN_MS, remaining / speed));
      // The target unit is committed the moment the slide lands.
      runAnimation(from, end, ms, () => commit(target));
    },
    [animation, commit, finishNow]
  );

  function turn(delta: number) {
    turnTo((pendingTargetRef.current ?? unitRef.current) + delta);
  }

  // Scale changes (pinch commit, fit mode, orientation): keep the pinched
  // point under the fingers, or else the same relative scroll position.
  useLayoutEffect(() => {
    const pane = currentPane();
    const content = currentContent();
    if (scale !== prevScaleRef.current) {
      prevScaleRef.current = scale;
      const pin = pendingZoomRef.current;
      if (pane) {
        if (pin) {
          const geo = unitGeometryRef.current(unitRef.current);
          const hit = geo.boxes.find((b) => b.page === pin.page);
          if (hit) {
            pane.scrollTop = hit.box.top + pin.fy * hit.box.height - pin.sy;
            pane.scrollLeft = hit.box.left + pin.fx * hit.box.width - pin.sx;
          }
        } else {
          const f = scrollFracRef.current;
          pane.scrollLeft = f.fx * Math.max(0, pane.scrollWidth - pane.clientWidth);
          pane.scrollTop = f.fy * Math.max(0, pane.scrollHeight - pane.clientHeight);
        }
      }
      pendingZoomRef.current = null;
      if (pendingZoomTimer.current) clearTimeout(pendingZoomTimer.current);
      if (content) {
        content.style.transition = "";
        content.style.transform = "";
        content.style.willChange = "";
      }
    }
    if (pane) setOverflowX(pane.scrollWidth > pane.clientWidth + 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, currentUnit, containerSize.width, containerSize.height]);

  useEffect(() => () => {
    finishNow();
    if (pendingZoomTimer.current) clearTimeout(pendingZoomTimer.current);
  }, [finishNow]);

  useImperativeHandle(
    ref,
    () => ({
      turn,
      swipeStart() {
        finishNow();
        draggingRef.current = true;
      },
      swipeMove(dx) {
        const u = unitsRef.current;
        const atStart = unitRef.current <= 1 && dx > 0;
        const atEnd = unitRef.current >= u.count && dx < 0;
        setOffset(atStart || atEnd ? dx * 0.25 : dx); // rubber-band at the ends of the book
      },
      swipeEnd({ dx, vx, cancelled }) {
        draggingRef.current = false;
        const w = widthRef.current || 1;
        const goNext = dx < 0;
        const far = Math.abs(dx) > w * COMMIT_DISTANCE;
        const flick = Math.abs(vx) > COMMIT_VELOCITY && Math.sign(vx) === Math.sign(dx);
        if (cancelled || !(far || flick)) {
          turnTo(unitRef.current, offsetRef.current, 0);
          return;
        }
        turnTo(unitRef.current + (goNext ? 1 : -1), offsetRef.current, vx);
      },
      zoomBegin(focal) {
        const pane = currentPane();
        const content = currentContent();
        if (!pane || !content) return;
        const rect = pane.getBoundingClientRect();
        const fx = focal.x - rect.left;
        const fy = focal.y - rect.top;
        const lx = pane.scrollLeft + fx;
        const ly = pane.scrollTop + fy;
        pinchRef.current = { fx, fy, lx, ly };
        content.style.transition = "";
        content.style.transformOrigin = `${lx}px ${ly}px`;
        content.style.willChange = "transform";
      },
      zoomPreview(ratio, dx, dy) {
        const content = currentContent();
        if (!content || !pinchRef.current) return;
        content.style.transform = `translate(${dx}px, ${dy}px) scale(${ratio})`;
      },
      zoomCommit(ratio, dx, dy) {
        const p = pinchRef.current;
        const content = currentContent();
        pinchRef.current = null;
        if (!p) return;
        const next = clampScale(scale * ratio);
        const mid = anchorAt(unitGeometryRef.current(unitRef.current).boxes, p.lx, p.ly);
        const reset = () => {
          if (content) {
            content.style.transition = "";
            content.style.transform = "";
            content.style.willChange = "";
          }
        };
        if (!mid || Math.abs(next - scale) < 0.001) {
          reset();
          return;
        }
        pendingZoomRef.current = { ...mid, sx: p.fx + dx, sy: p.fy + dy };
        pendingZoomTimer.current = setTimeout(() => {
          pendingZoomRef.current = null;
          reset();
        }, 600);
        onScaleRequest(next);
      },
      zoomAnimateTo(target, focal) {
        const pane = currentPane();
        const content = currentContent();
        if (!pane || !content) return;
        const rect = pane.getBoundingClientRect();
        const fx = focal.x - rect.left;
        const fy = focal.y - rect.top;
        const lx = pane.scrollLeft + fx;
        const ly = pane.scrollTop + fy;
        const next = clampScale(target);
        const ratio = next / scale;
        const mid = anchorAt(unitGeometryRef.current(unitRef.current).boxes, lx, ly);
        if (!mid || Math.abs(ratio - 1) < 0.001) return;
        content.style.transformOrigin = `${lx}px ${ly}px`;
        content.style.willChange = "transform";
        content.style.transition = "transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)";
        requestAnimationFrame(() => {
          content.style.transform = `scale(${ratio})`;
        });
        window.setTimeout(() => {
          pendingZoomRef.current = { ...mid, sx: fx, sy: fy };
          onScaleRequest(next);
        }, 230);
      },
      overflowsX() {
        const pane = currentPane();
        return !!pane && pane.scrollWidth > pane.clientWidth + 2;
      },
      goToPage(page) {
        finishNow();
        const u = unitsRef.current;
        const unit = u.unitOf(Math.min(Math.max(1, page), u.pages(u.count).slice(-1)[0] ?? page));
        if (unit === unitRef.current) {
          const pane = currentPane();
          if (pane) pane.scrollTo({ top: 0 });
          return;
        }
        commit(unit);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, animation, turnTo, commit, finishNow, onScaleRequest]
  );

  const paneUnits: number[] = [];
  for (let u = currentUnit - WINDOW; u <= currentUnit + WINDOW; u++) if (u >= 1 && u <= units.count) paneUnits.push(u);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background-secondary">
      <div ref={stripRef} className="group/strip absolute inset-0 will-change-transform">
        {paneUnits.map((u) => {
          const isCurrent = u === currentUnit;
          const geo = unitGeometry(u);
          const distance = Math.abs(u - currentUnit);
          return (
            <div
              key={u}
              ref={(el) => {
                if (el) paneRefs.current.set(u, el);
                else paneRefs.current.delete(u);
              }}
              data-scroll-surface=""
              aria-hidden={!isCurrent}
              onScroll={(e) => {
                if (!isCurrent) return;
                const el = e.currentTarget;
                scrollFracRef.current = {
                  fx: el.scrollWidth > el.clientWidth ? el.scrollLeft / (el.scrollWidth - el.clientWidth) : 0.5,
                  fy: el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0,
                };
              }}
              className={`absolute top-0 h-full w-full overflow-auto bg-background-secondary group-data-[moving]/strip:shadow-[0_0_28px_rgba(0,0,0,0.22)] ${
                isCurrent ? "" : "pointer-events-none"
              }`}
              style={{
                left: `${(u - currentUnit) * 100}%`,
                touchAction: overflowX && isCurrent ? "pan-x pan-y" : baseTouchAction,
                overscrollBehavior: "contain",
              }}
            >
              <div
                ref={(el) => {
                  if (el) contentRefs.current.set(u, el);
                  else contentRefs.current.delete(u);
                }}
                className="relative"
                style={{ width: geo.contentW, height: geo.contentH }}
              >
                {geo.boxes.map(({ page, box }) =>
                  renderPage(
                    page,
                    { position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height },
                    distance === 0 ? 0 : distance === 1 ? 60 : 350
                  )
                )}
                {geo.boxes.length === 2 && (
                  // Gutter shadow: makes two flat pages read as one bound spread.
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: geo.boxes[0].box.left + geo.boxes[0].box.width - 14,
                      top: Math.min(geo.boxes[0].box.top, geo.boxes[1].box.top),
                      width: 28,
                      height: Math.max(geo.boxes[0].box.height, geo.boxes[1].box.height),
                      background: "linear-gradient(to right, transparent, rgba(0,0,0,0.10), transparent)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
