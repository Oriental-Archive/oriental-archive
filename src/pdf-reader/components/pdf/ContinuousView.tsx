import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePageLayout, type useNaturalSizes } from "@/pdf-reader/hooks/usePageLayout";
import { clampScale } from "@/pdf-reader/hooks/useFitScale";
import { anchorAt, type Anchor, type RenderPage, type SurfaceHandle } from "@/pdf-reader/components/pdf/surface";

type Props = {
  numPages: number;
  currentPage: number;
  /** Fraction of `currentPage` at the top of the viewport to restore on mount. */
  initialOffset: number;
  scale: number;
  natural: ReturnType<typeof useNaturalSizes>;
  gap: number;
  /** Horizontal + vertical margin around pages, in px. */
  padding: number;
  containerWidth: number;
  renderPage: RenderPage;
  onPageChange: (page: number) => void;
  /** Reports where the reader is (page + fraction) so it can be restored later. */
  onPositionChange: (page: number, offset: number) => void;
  onScaleRequest: (scale: number) => void;
  smoothScrolling: boolean;
  touchAction: string;
};

type PinchState = { fx: number; fy: number; lx: number; ly: number };
type PendingZoom = Anchor & { sx: number; sy: number };
type Settle = { page: number; fy: number; until: number; lastTop: number };

/**
 * Continuous vertical scroll. Only pages near the viewport are mounted;
 * everything else is an empty, correctly-sized gap, so a 500-page book costs
 * a handful of canvases regardless of length.
 */
export const ContinuousView = forwardRef<SurfaceHandle, Props>(function ContinuousView(
  {
    numPages,
    currentPage,
    initialOffset,
    scale,
    natural,
    gap,
    padding,
    containerWidth,
    renderPage,
    onPageChange,
    onPositionChange,
    onScaleRequest,
    smoothScrolling,
    touchAction,
  },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const layout = usePageLayout(numPages, scale, gap, natural);
  const [range, setRange] = useState({ start: Math.max(1, currentPage - 1), end: Math.min(numPages, currentPage + 1) });
  const [pinching, setPinching] = useState(false);

  // Pages are positioned by pixel offset (not left:50% + translateX) so that
  // when a zoomed page is wider than the viewport the scroll area really
  // extends to both edges — a centered transform overflows only rightward and
  // leaves the page's left half unreachable.
  const contentWidth = Math.max(containerWidth, layout.maxPageWidth + padding);

  const pinchRef = useRef<PinchState | null>(null);
  const pendingZoomRef = useRef<PendingZoom | null>(null);
  const pendingZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef<Settle | null>(null);
  const topAnchorRef = useRef<{ page: number; fy: number }>({ page: currentPage, fy: initialOffset });
  const prevScaleRef = useRef(scale);
  const raf = useRef(0);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const contentWidthRef = useRef(contentWidth);
  contentWidthRef.current = contentWidth;
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const bufferRef = useRef(1);
  bufferRef.current = pinching ? 3 : 1;

  const pageBox = useCallback(
    (page: number) => {
      const r = layoutRef.current.getPageRect(page);
      return { left: (contentWidthRef.current - r.width) / 2, top: r.top, width: r.width, height: r.height };
    },
    []
  );

  const computeRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return { start: 1, end: 1 };
    const l = layoutRef.current;
    const buffer = bufferRef.current;
    const start = Math.max(1, l.pageAtOffset(el.scrollTop) - buffer);
    const end = Math.min(numPages, l.pageAtOffset(el.scrollTop + el.clientHeight) + buffer);
    return { start, end };
  }, [numPages]);

  const updateRange = useCallback(() => {
    const next = computeRange();
    setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, [computeRange]);

  const applyScroll = useCallback((top: number, left?: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = top;
    if (left !== undefined) el.scrollLeft = left;
  }, []);

  const goToPage = useCallback(
    (page: number, offset = 0, smooth = false) => {
      const el = scrollRef.current;
      if (!el) return;
      const p = Math.min(Math.max(1, page), numPages);
      const r = layoutRef.current.getPageRect(p);
      const top = r.top + offset * r.height;
      // Sizes of not-yet-measured pages are estimates, so the target moves as
      // pages render. Re-assert it (until the user scrolls) instead of landing
      // on whatever the first estimate said.
      settleRef.current = { page: p, fy: offset, until: performance.now() + 1500, lastTop: top };
      if (smooth && smoothScrolling) el.scrollTo({ top, behavior: "smooth" });
      else applyScroll(top);
    },
    [numPages, smoothScrolling, applyScroll]
  );

  // Restore the reader's place on mount (also runs when switching into this view from page turn).
  useLayoutEffect(() => {
    goToPage(currentPage, initialOffset);
    updateRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sizes changed (a page just measured): keep a pending jump on target.
  useLayoutEffect(() => {
    const s = settleRef.current;
    const el = scrollRef.current;
    if (!s || !el) return;
    if (performance.now() > s.until) {
      settleRef.current = null;
      return;
    }
    const r = layout.getPageRect(s.page);
    const top = r.top + s.fy * r.height;
    if (Math.abs(top - el.scrollTop) > 1) {
      s.lastTop = top;
      el.scrollTop = top;
    }
  }, [layout]);

  // Scale changed (zoom, fit mode, orientation): keep the reader looking at
  // the same spot instead of whatever now sits at the old pixel offset.
  useLayoutEffect(() => {
    if (scale === prevScaleRef.current) return;
    prevScaleRef.current = scale;
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;

    const pin = pendingZoomRef.current;
    if (pin) {
      const box = pageBox(pin.page);
      applyScroll(box.top + pin.fy * box.height - pin.sy, box.left + pin.fx * box.width - pin.sx);
      pendingZoomRef.current = null;
      if (pendingZoomTimer.current) clearTimeout(pendingZoomTimer.current);
    } else {
      const a = topAnchorRef.current;
      const r = layout.getPageRect(a.page);
      applyScroll(r.top + a.fy * r.height);
    }
    if (content) {
      content.style.transition = "";
      content.style.transform = "";
      content.style.willChange = "";
    }
    setPinching(false);
    updateRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    if (pendingZoomTimer.current) clearTimeout(pendingZoomTimer.current);
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const s = settleRef.current;
    if (s && Math.abs(el.scrollTop - s.lastTop) > 3) settleRef.current = null; // the user took over

    const page = layout.pageAtOffset(el.scrollTop + 24);
    const r = layout.getPageRect(page);
    const fy = r.height > 0 ? Math.min(1, Math.max(0, (el.scrollTop - r.top) / r.height)) : 0;
    topAnchorRef.current = { page, fy };
    if (page !== currentPage) onPageChange(page);
    onPositionChange(page, fy);

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(updateRange);
  }

  useImperativeHandle(
    ref,
    () => ({
      zoomBegin(focal) {
        const el = scrollRef.current;
        const content = contentRef.current;
        if (!el || !content) return;
        const rect = el.getBoundingClientRect();
        const fx = focal.x - rect.left;
        const fy = focal.y - rect.top;
        const lx = el.scrollLeft + fx;
        const ly = el.scrollTop + fy;
        pinchRef.current = { fx, fy, lx, ly };
        content.style.transition = "";
        content.style.transformOrigin = `${lx}px ${ly}px`;
        content.style.willChange = "transform";
        setPinching(true);
      },
      zoomPreview(ratio, dx, dy) {
        const content = contentRef.current;
        if (!content || !pinchRef.current) return;
        content.style.transform = `translate(${dx}px, ${dy}px) scale(${ratio})`;
      },
      zoomCommit(ratio, dx, dy) {
        const p = pinchRef.current;
        const content = contentRef.current;
        pinchRef.current = null;
        if (!p) return;
        const next = clampScale(scale * ratio);
        const mid = anchorAt(
          visiblePages().map((page) => ({ page, box: pageBox(page) })),
          p.lx,
          p.ly
        );
        if (!mid || Math.abs(next - scale) < 0.001) {
          if (content) {
            content.style.transform = "";
            content.style.willChange = "";
          }
          setPinching(false);
          return;
        }
        pendingZoomRef.current = { ...mid, sx: p.fx + dx, sy: p.fy + dy };
        // If the scale never changes (state rejected), don't leave the page stuck mid-transform.
        pendingZoomTimer.current = setTimeout(() => {
          pendingZoomRef.current = null;
          if (content) {
            content.style.transform = "";
            content.style.willChange = "";
          }
          setPinching(false);
        }, 600);
        onScaleRequest(next);
      },
      zoomAnimateTo(target, focal) {
        const el = scrollRef.current;
        const content = contentRef.current;
        if (!el || !content) return;
        const rect = el.getBoundingClientRect();
        const fx = focal.x - rect.left;
        const fy = focal.y - rect.top;
        const lx = el.scrollLeft + fx;
        const ly = el.scrollTop + fy;
        const next = clampScale(target);
        const ratio = next / scale;
        const mid = anchorAt(
          visiblePages().map((page) => ({ page, box: pageBox(page) })),
          lx,
          ly
        );
        if (!mid || Math.abs(ratio - 1) < 0.001) return;
        content.style.transformOrigin = `${lx}px ${ly}px`;
        content.style.willChange = "transform";
        content.style.transition = "transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)";
        setPinching(true);
        requestAnimationFrame(() => {
          content.style.transform = `scale(${ratio})`;
        });
        window.setTimeout(() => {
          pendingZoomRef.current = { ...mid, sx: fx, sy: fy };
          onScaleRequest(next);
        }, 230);
      },
      overflowsX() {
        const el = scrollRef.current;
        return !!el && el.scrollWidth > el.clientWidth + 2;
      },
      goToPage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, goToPage, onScaleRequest]
  );

  function visiblePages(): number[] {
    const pages: number[] = [];
    for (let p = rangeRef.current.start; p <= rangeRef.current.end; p++) pages.push(p);
    return pages;
  }

  const style: CSSProperties = {
    touchAction,
    overscrollBehavior: "contain",
    // Text selection handles and long-press must belong to the page, not the browser's own pan.
    WebkitOverflowScrolling: "touch",
  };

  return (
    <div
      ref={scrollRef}
      data-scroll-surface=""
      onScroll={handleScroll}
      className="h-full w-full overflow-auto bg-background-secondary"
      style={style}
    >
      <div ref={contentRef} className="relative" style={{ height: layout.totalHeight, width: contentWidth }}>
        {visiblePages().map((page) => {
          const box = pageBox(page);
          const near = Math.abs(page - currentPage) <= 1;
          return renderPage(
            page,
            { position: "absolute", top: box.top, left: box.left, width: box.width, height: box.height },
            near ? 0 : 160
          );
        })}
      </div>
    </div>
  );
});
