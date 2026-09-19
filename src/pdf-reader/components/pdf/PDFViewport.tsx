import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import type {
  Annotation,
  HighlightColor,
  LayoutMode,
  NewAnnotationInput,
  PageAnimation,
  PdfAppearance,
  ToolId,
  ZoomMode,
} from "@/pdf-reader/types";
import { PdfPage } from "@/pdf-reader/components/pdf/PdfPage";
import { AnnotationLayer } from "@/pdf-reader/components/pdf/AnnotationLayer";
import { SelectionToolbar } from "@/pdf-reader/components/pdf/SelectionToolbar";
import { ContinuousView } from "@/pdf-reader/components/pdf/ContinuousView";
import { PageTurnView, makeUnits, type PageTurnHandle } from "@/pdf-reader/components/pdf/PageTurnView";
import type { RenderPage, SurfaceHandle } from "@/pdf-reader/components/pdf/surface";
import { useNaturalSizes } from "@/pdf-reader/hooks/usePageLayout";
import { scrollbarWidth, useElementSize } from "@/pdf-reader/hooks/useElementSize";
import { PAGE_PADDING, clampScale, useFitScale } from "@/pdf-reader/hooks/useFitScale";
import { useTextSelection } from "@/pdf-reader/hooks/useTextSelection";
import { useAnnotationInput } from "@/pdf-reader/hooks/useAnnotationInput";
import { useTouchGestures, type TouchGestureHandlers } from "@/pdf-reader/hooks/useTouchGestures";
import type { FormFactor } from "@/pdf-reader/hooks/useDeviceProfile";
import { toCanonicalPoint, toCanonicalRect } from "@/pdf-reader/lib/rotation";

export type SearchHighlightState = {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  activePage: number | null;
  activeOrdinalOnPage: number | null;
};

export type PdfViewportHandle = {
  goToPage: (page: number, offset?: number) => void;
  stepPage: (delta: number) => void;
};

type Props = {
  pdf: PDFDocumentProxy;
  numPages: number;
  annotations: Annotation[];
  showAnnotations: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  zoomMode: ZoomMode;
  zoomLevel: number;
  onZoomLevelChange: (level: number) => void;
  onZoomModeChange: (mode: ZoomMode) => void;
  layoutMode: LayoutMode;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  appearance: PdfAppearance;
  activeTool: ToolId;
  pendingColor: HighlightColor;
  onPendingColorChange: (c: HighlightColor) => void;
  search: SearchHighlightState;
  onCreateAnnotation: (input: NewAnnotationInput, opensEditor: boolean) => void;
  onAnnotationSelect: (annotation: Annotation) => void;
  onCopy: (text: string) => void;
  onQuote: (page: number, text: string) => void;
  onCite: (page: number, text: string) => void;
  onAddToNotes: (page: number, text: string) => void;
  onInternalLink: (destPage: number) => void;
  onScaleChange?: (scale: number) => void;
  smoothScrolling: boolean;
  /** View-only for an audience: no tool-driven creation, no floating selection toolbar, no opening an annotation's editor. */
  presenting?: boolean;
  /** Presentation laser pointer: a cursor-following dot, purely visual — never recorded as an annotation. */
  pointerActive?: boolean;
  /** Interaction model, not just size: phones get tighter margins, a thumb-reachable selection bar, and tap zones. */
  form?: FormFactor;
  /** Primary input is a finger. */
  touch?: boolean;
  pageAnimation?: PageAnimation;
  /** Page turn: tap the left/right edge of the screen to turn. */
  edgeTaps?: boolean;
  /** Fraction of `currentPage` at the top of the viewport to restore on mount (continuous). */
  initialOffset?: number;
  onPositionChange?: (page: number, offset: number) => void;
  /** A tap that isn't a page turn or a mark — the phone shell uses it to show/hide its controls. */
  onCenterTap?: () => void;
  onSelectionActiveChange?: (active: boolean) => void;
};

const GAP: Record<FormFactor, number> = { phone: 10, tablet: 14, desktop: 20 };
const EDGE_ZONE = 0.22; // fraction of the width on each side that turns the page when tapped
const ZOOMED_OUT_TOLERANCE = 1.15;
const SMART_ZOOM = 2.4;

export const PDFViewport = forwardRef<PdfViewportHandle, Props>(function PDFViewport(
  {
    pdf,
    numPages,
    annotations,
    showAnnotations,
    currentPage,
    onPageChange,
    zoomMode,
    zoomLevel,
    onZoomLevelChange,
    onZoomModeChange,
    layoutMode,
    rotation,
    flipVertical,
    appearance,
    activeTool,
    pendingColor,
    onPendingColorChange,
    search,
    onCreateAnnotation,
    onAnnotationSelect,
    onCopy,
    onQuote,
    onCite,
    onAddToNotes,
    onInternalLink,
    onScaleChange,
    smoothScrolling,
    presenting = false,
    pointerActive = false,
    form = "desktop",
    touch = false,
    pageAnimation = "on",
    edgeTaps = true,
    initialOffset = 0,
    onPositionChange,
    onCenterTap,
    onSelectionActiveChange,
  },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const continuousRef = useRef<SurfaceHandle>(null);
  const pageTurnRef = useRef<PageTurnHandle>(null);
  const measured = useElementSize(rootRef);
  // The scroller inside is narrower than the element measured here by one
  // classic scrollbar; fitting to the full width made every page that much too
  // wide, so a horizontal scrollbar appeared at the default zoom.
  const containerSize = useMemo(
    () => ({ width: Math.max(0, measured.width - scrollbarWidth()), height: measured.height }),
    [measured]
  );
  const natural = useNaturalSizes();
  const setNaturalSize = natural.setNaturalSize;

  const pageTurn = layoutMode !== "continuous";
  const spread = layoutMode === "two-page";
  const units = useMemo(() => makeUnits(numPages, spread), [numPages, spread]);
  const padding = PAGE_PADDING[form];
  const columns = spread ? 2 : 1;

  const scale = useFitScale(zoomMode, zoomLevel, natural.referenceSize, containerSize, padding, columns);
  const fitWidthScale = useFitScale("fit-width", 1, natural.referenceSize, containerSize, padding, columns);
  const fitPageScale = useFitScale("fit-page", 1, natural.referenceSize, containerSize, padding, columns);

  useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  // A pinch/double-tap that lands on (or very near) a fit size re-engages that
  // fit mode instead of freezing a custom level, so rotating the phone later
  // still refits. Anywhere else stays a free, continuous zoom.
  const requestScale = useCallback(
    (next: number) => {
      const near = (target: number) => Math.abs(next - target) / target < 0.02;
      if (near(fitWidthScale)) onZoomModeChange("fit-width");
      else if (near(fitPageScale)) onZoomModeChange("fit-page");
      else onZoomLevelChange(clampScale(next));
    },
    [fitWidthScale, fitPageScale, onZoomLevelChange, onZoomModeChange]
  );

  // Rects/points are captured from screen positions, i.e. in whatever
  // rotation is currently on screen. Canonicalize to rotation-0 page space
  // right here, at the single point every creation path funnels through, so
  // no capture site can forget to and leave an annotation pointing at the
  // wrong spot once the page is rotated again.
  const createAnnotation = useCallback(
    (input: NewAnnotationInput, opensEditor: boolean) => {
      onCreateAnnotation(
        {
          ...input,
          rects: input.rects.map((r) => toCanonicalRect(r, rotation, flipVertical)),
          points: input.points ? input.points.map((p) => toCanonicalPoint(p, rotation, flipVertical)) : null,
        },
        opensEditor
      );
    },
    [onCreateAnnotation, rotation, flipVertical]
  );

  const selection = useTextSelection(rootRef);
  const { pending, setPending } = selection;
  const input = useAnnotationInput({ rootRef, activeTool, presenting, pointerActive, pendingColor, createAnnotation, selection });

  const surface = (): SurfaceHandle | null => (pageTurn ? pageTurnRef.current : continuousRef.current);

  useImperativeHandle(
    ref,
    () => ({
      goToPage(page, offset) {
        surface()?.goToPage(page, offset);
      },
      stepPage(delta) {
        const target = Math.min(Math.max(1, currentPage + delta), numPages);
        if (pageTurn) pageTurnRef.current?.turn(delta);
        else continuousRef.current?.goToPage(target, 0, true);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageTurn, currentPage, numPages]
  );

  const annotationsByPage = useCallback(
    (page: number) => (showAnnotations ? annotations.filter((a) => a.page === page) : []),
    [annotations, showAnnotations]
  );

  // ---- selection actions -------------------------------------------------
  const finishSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setPending(null);
  }, [setPending]);

  const applySelection = useCallback(
    (type: "highlight" | "underline" | "strikethrough" | "note", color: HighlightColor, opensEditor = false) => {
      if (!pending) return;
      createAnnotation(
        {
          id: crypto.randomUUID(),
          type,
          page: pending.page,
          color,
          selectedText: pending.text,
          rects: pending.rects,
          points: null,
          comment: "",
          tags: [],
        },
        opensEditor
      );
      finishSelection();
    },
    [pending, createAnnotation, finishSelection]
  );

  const selectionActive = !!pending && !presenting;
  useEffect(() => {
    onSelectionActiveChange?.(selectionActive);
  }, [selectionActive, onSelectionActiveChange]);
  // A selection belongs to the page it was made on; leaving it behind while
  // presenting would leak an editing toolbar onto the audience's screen.
  useEffect(() => {
    if (presenting && pending) setPending(null);
  }, [presenting, pending, setPending]);

  const selectionUi = form === "phone" ? "bar" : "floating";
  const toolbarProps = pending
    ? {
        pending,
        color: pendingColor,
        onPickColor: (c: HighlightColor) => {
          onPendingColorChange(c);
          applySelection("highlight", c);
        },
        onHighlight: () => applySelection("highlight", pendingColor),
        onUnderline: () => applySelection("underline", pendingColor),
        onStrikethrough: () => applySelection("strikethrough", pendingColor),
        onAddNote: () => applySelection("note", pendingColor, true),
        onCopy: () => {
          onCopy(pending.text);
          finishSelection();
        },
        onQuote: () => {
          onQuote(pending.page, pending.text);
          finishSelection();
        },
        onCite: () => {
          onCite(pending.page, pending.text);
          finishSelection();
        },
        onAddToNotes: () => {
          onAddToNotes(pending.page, pending.text);
          finishSelection();
        },
      }
    : null;

  // ---- one page (canvas + marks + previews + inline toolbar) --------------
  const renderPage: RenderPage = (page, style, deferMs) => {
    const activeOrdinal = search.activePage === page ? search.activeOrdinalOnPage : null;
    return (
      <div key={page} data-page-wrapper={page} className="bg-surface shadow-sm" style={style}>
        <PdfPage
          pdf={pdf}
          pageNumber={page}
          scale={scale}
          rotation={rotation}
          flipVertical={flipVertical}
          appearance={appearance}
          searchQuery={search.query}
          searchCaseSensitive={search.caseSensitive}
          searchWholeWord={search.wholeWord}
          activeMatchOrdinal={activeOrdinal}
          onNaturalSize={setNaturalSize}
          onInternalLink={onInternalLink}
          deferMs={deferMs}
        />
        <AnnotationLayer
          annotations={annotationsByPage(page)}
          rotation={rotation}
          flipVertical={flipVertical}
          onSelect={onAnnotationSelect}
        />
        {input.drawPreview?.page === page && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={input.drawPreview.points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
              fill="none"
              stroke={`var(--highlight-${pendingColor})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {input.areaPreview?.page === page && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
            style={{
              left: `${input.areaPreview.rect.x * 100}%`,
              top: `${input.areaPreview.rect.y * 100}%`,
              width: `${input.areaPreview.rect.w * 100}%`,
              height: `${input.areaPreview.rect.h * 100}%`,
            }}
          />
        )}
        {toolbarProps && selectionUi === "floating" && !presenting && pending?.page === page && (
          <SelectionToolbar {...toolbarProps} variant="floating" below={touch} />
        )}
      </div>
    );
  };

  // ---- gestures ----------------------------------------------------------
  const creationToolActive = activeTool === "draw" || activeTool === "area" || activeTool === "note" || activeTool === "comment";
  // A creation tool owns finger movement, so the browser must not scroll under it.
  const baseTouchAction = activeTool === "draw" || activeTool === "area" ? "none" : pageTurn ? "pan-y" : "pan-x pan-y";

  const gestureRef = useRef<TouchGestureHandlers>({});
  gestureRef.current = {
    pinchStart: (focal) => surface()?.zoomBegin(focal),
    pinchMove: ({ ratio, dx, dy }) => surface()?.zoomPreview(ratio, dx, dy),
    pinchEnd: ({ ratio, dx, dy }) => surface()?.zoomCommit(ratio, dx, dy),
    swipeStart: () => pageTurnRef.current?.swipeStart(),
    swipeMove: (dx) => pageTurnRef.current?.swipeMove(dx),
    swipeEnd: (e) => pageTurnRef.current?.swipeEnd(e),
    canSwipe: () => pageTurn && !creationToolActive && !surface()?.overflowsX(),
    blocked: () => creationToolActive,
    tapDelay: ({ x }) => (isEdgeTap(x) === 0 ? 240 : 0),
    tap: ({ x }) => {
      const edge = isEdgeTap(x);
      if (edge !== 0) pageTurnRef.current?.turn(edge);
      else onCenterTap?.();
    },
    doubleTap: ({ x, y }) => {
      const s = surface();
      if (!s) return;
      // Zoomed in past fit-width -> back out; otherwise punch in on the tapped spot.
      if (scale > fitWidthScale * ZOOMED_OUT_TOLERANCE) s.zoomAnimateTo(fitWidthScale, { x, y });
      else s.zoomAnimateTo(Math.min(fitWidthScale * SMART_ZOOM, 6), { x, y });
    },
  };

  /** -1 / 1 for a tap in the left/right edge zone of a page-turn view, 0 otherwise (center or continuous). */
  function isEdgeTap(clientX: number): -1 | 0 | 1 {
    const root = rootRef.current;
    if (!pageTurn || !edgeTaps || !root || surface()?.overflowsX()) return 0;
    const rel = (clientX - root.getBoundingClientRect().left) / root.clientWidth;
    if (rel < EDGE_ZONE) return -1;
    if (rel > 1 - EDGE_ZONE) return 1;
    return 0;
  }

  useTouchGestures(rootRef, gestureRef);

  // Trackpad/mouse-wheel: ctrl+wheel (a trackpad pinch) zooms about the cursor
  // instead of zooming the whole browser page; a horizontal two-finger swipe
  // turns the page in page-turn mode. Native listener: React's onWheel is passive
  // and can't preventDefault.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let zoom: { ratio: number; timer: ReturnType<typeof setTimeout> } | null = null;
    let swipeAccum = 0;
    let lastTurn = 0;

    function onWheel(e: WheelEvent) {
      const s = surface();
      if (!s) return;
      if (e.ctrlKey) {
        e.preventDefault();
        if (!zoom) {
          s.zoomBegin({ x: e.clientX, y: e.clientY });
          zoom = { ratio: 1, timer: 0 as unknown as ReturnType<typeof setTimeout> };
        }
        zoom.ratio = Math.min(6, Math.max(0.2, zoom.ratio * Math.exp(-e.deltaY * 0.01)));
        s.zoomPreview(zoom.ratio, 0, 0);
        clearTimeout(zoom.timer);
        const z = zoom;
        z.timer = setTimeout(() => {
          s.zoomCommit(z.ratio, 0, 0);
          zoom = null;
        }, 150);
        return;
      }
      if (pageTurn && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && !s.overflowsX()) {
        e.preventDefault();
        swipeAccum += e.deltaX;
        const now = performance.now();
        // Trackpad inertia keeps emitting deltas after the fingers lift — one turn per flick.
        if (Math.abs(swipeAccum) > 90 && now - lastTurn > 450) {
          pageTurnRef.current?.turn(swipeAccum > 0 ? 1 : -1);
          lastTurn = now;
          swipeAccum = 0;
        }
      } else {
        swipeAccum = 0;
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (zoom) clearTimeout(zoom.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTurn]);

  // ---- cursor ------------------------------------------------------------
  const cursorClass =
    pointerActive
      ? "cursor-none"
      : activeTool === "pan"
        ? "cursor-grab active:cursor-grabbing"
        : activeTool === "note" || activeTool === "comment"
          ? "cursor-copy"
          : activeTool === "area" || activeTool === "draw"
            ? "cursor-crosshair"
            : "";

  // Mouse users get large hover-revealed edge buttons in page-turn mode ("click the side to turn").
  const showEdgeButtons = pageTurn && !touch && !creationToolActive && activeTool !== "pan";
  const edgeButton = (dir: -1 | 1) => {
    const disabled = dir < 0 ? currentPage <= 1 : currentPage >= numPages;
    const side: CSSProperties = dir < 0 ? { left: 0 } : { right: 0 };
    return (
      <button
        type="button"
        data-no-gesture=""
        aria-label={dir < 0 ? "Previous page" : "Next page"}
        disabled={disabled}
        onClick={() => pageTurnRef.current?.turn(dir)}
        className="group absolute top-0 z-10 flex h-full items-center justify-center outline-none disabled:pointer-events-none"
        style={{ ...side, width: "clamp(44px, 7%, 88px)" }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-elevated/90 text-text-secondary opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {dir < 0 ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </span>
      </button>
    );
  };

  const commonSurface = {
    scale,
    natural,
    padding,
    renderPage,
    onPageChange,
    onScaleRequest: requestScale,
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="Document pages"
      onPointerDown={input.handlers.onPointerDown}
      onPointerMove={input.handlers.onPointerMove}
      onPointerUp={input.handlers.onPointerUp}
      onPointerCancel={input.handlers.onPointerCancel}
      onPointerLeave={input.handlers.onPointerLeave}
      className={`relative h-full w-full overflow-hidden ${cursorClass}`}
    >
      {input.pointerPos && pointerActive && (
        <div
          className="pointer-events-none fixed z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger/70 shadow-[0_0_12px_4px_var(--danger)]"
          style={{ left: input.pointerPos.x, top: input.pointerPos.y }}
        />
      )}

      {pageTurn ? (
        <PageTurnView
          ref={pageTurnRef}
          {...commonSurface}
          units={units}
          currentPage={currentPage}
          containerSize={containerSize}
          animation={pageAnimation}
          baseTouchAction={baseTouchAction}
        />
      ) : (
        <ContinuousView
          ref={continuousRef}
          {...commonSurface}
          numPages={numPages}
          currentPage={currentPage}
          initialOffset={initialOffset}
          gap={GAP[form]}
          containerWidth={containerSize.width}
          onPositionChange={onPositionChange ?? (() => {})}
          smoothScrolling={smoothScrolling}
          touchAction={baseTouchAction}
        />
      )}

      {showEdgeButtons && (
        <>
          {edgeButton(-1)}
          {edgeButton(1)}
        </>
      )}

      {toolbarProps && selectionUi === "bar" && !presenting && <SelectionToolbar {...toolbarProps} variant="bar" />}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Page {currentPage} of {numPages}
      </div>
    </div>
  );
});
