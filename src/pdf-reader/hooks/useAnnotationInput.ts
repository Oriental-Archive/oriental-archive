import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { HighlightColor, NewAnnotationInput, Point, Rect, ToolId } from "@/pdf-reader/types";
import type { useTextSelection } from "@/pdf-reader/hooks/useTextSelection";

type Params = {
  rootRef: RefObject<HTMLElement | null>;
  activeTool: ToolId;
  presenting: boolean;
  pointerActive: boolean;
  pendingColor: HighlightColor;
  /** Canonicalizing wrapper — every creation path funnels through it. */
  createAnnotation: (input: NewAnnotationInput, opensEditor: boolean) => void;
  selection: ReturnType<typeof useTextSelection>;
};

type Drag =
  | { kind: "draw"; page: number }
  | { kind: "area"; page: number; startX: number; startY: number }
  | { kind: "note"; page: number; x: number; y: number; cx: number; cy: number }
  | { kind: "pan"; surface: HTMLElement; cx: number; cy: number; left: number; top: number };

const TAP_SLOP = 8;
const PALM_REJECT_MS = 1000;

const newId = () => crypto.randomUUID();

function pageWrapperAt(target: EventTarget | null): { el: HTMLElement; page: number } | null {
  const el = (target as HTMLElement | null)?.closest?.("[data-page-wrapper]") as HTMLElement | null;
  if (!el) return null;
  const page = Number(el.dataset.pageWrapper);
  return Number.isFinite(page) ? { el, page } : null;
}

/**
 * Pointer-event annotation input: the freehand pen, area box, note pins, mouse
 * pan, laser pointer, and the mouse "select then act" path. Pointer events
 * (not mouse events) so a finger, a stylus, and a mouse all work; touches that
 * turn into a second finger abort the stroke so a pinch never leaves a stray
 * mark; and a stylus in use rejects the resting palm.
 */
export function useAnnotationInput({ rootRef, activeTool, presenting, pointerActive, pendingColor, createAnnotation, selection }: Params) {
  const [drawPreview, setDrawPreview] = useState<{ page: number; points: Point[] } | null>(null);
  const [areaPreview, setAreaPreview] = useState<{ page: number; rect: Rect } | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const areaRef = useRef<Rect | null>(null);
  const activePointers = useRef<Set<number>>(new Set());
  const penSeenAt = useRef(0);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const abort = useCallback(() => {
    dragRef.current = null;
    pointsRef.current = [];
    areaRef.current = null;
    setDrawPreview(null);
    setAreaPreview(null);
  }, []);

  const flushPreview = useCallback((page: number) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setDrawPreview({ page, points: [...pointsRef.current] }));
  }, []);

  function onPointerDown(e: ReactPointerEvent) {
    activePointers.current.add(e.pointerId);
    if (e.pointerType === "pen") penSeenAt.current = performance.now();
    if (activePointers.current.size > 1) {
      abort(); // a second finger means pinch, not annotate
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A resting palm arrives as a touch right around stylus input — ignore it.
    if (e.pointerType === "touch" && performance.now() - penSeenAt.current < PALM_REJECT_MS) return;

    // Presenting is view-only: no tool-driven creation, and clicking an
    // existing mark shouldn't pop its editor open in front of an audience.
    // The freehand pen and highlighter stay available to mark up a point
    // live — everything else (pan, note, area, clicking existing marks) is
    // still blocked. The laser pointer takes over the mouse entirely while
    // active, even if a drawing tool is still technically selected.
    if (presenting && (pointerActive || (activeTool !== "draw" && activeTool !== "highlight"))) return;

    const found = pageWrapperAt(e.target);
    if (!found) return;
    const rect = found.el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Clicking an existing highlight/note/link — its own onClick opens the
    // editor or navigates. Without this guard, a creation tool (note/area/
    // draw) still being active would ALSO fire here on the same press and
    // stack a second, unwanted annotation right under the one clicked.
    const onExistingMark = (e.target as HTMLElement | null)?.closest?.("[data-annotation-mark]");
    if (onExistingMark && activeTool !== "pan") return;

    const root = rootRef.current;
    if (activeTool === "pan") {
      // Touch pans natively; this is only the click-and-drag "hand" for mouse/pen.
      if (e.pointerType === "touch") return;
      const surface = (e.target as HTMLElement).closest<HTMLElement>("[data-scroll-surface]");
      if (surface) dragRef.current = { kind: "pan", surface, cx: e.clientX, cy: e.clientY, left: surface.scrollLeft, top: surface.scrollTop };
    } else if (activeTool === "draw") {
      dragRef.current = { kind: "draw", page: found.page };
      pointsRef.current = [{ x, y }];
      setDrawPreview({ page: found.page, points: [{ x, y }] });
      root?.setPointerCapture?.(e.pointerId);
    } else if (activeTool === "area") {
      dragRef.current = { kind: "area", page: found.page, startX: x, startY: y };
      areaRef.current = { x, y, w: 0, h: 0 };
      setAreaPreview({ page: found.page, rect: { x, y, w: 0, h: 0 } });
      root?.setPointerCapture?.(e.pointerId);
    } else if (activeTool === "note" || activeTool === "comment") {
      // Created on release (if the finger/mouse barely moved), not on press —
      // otherwise starting a scroll with the note tool armed drops a stray pin.
      dragRef.current = { kind: "note", page: found.page, x, y, cx: e.clientX, cy: e.clientY };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (pointerActive) setPointerPos({ x: e.clientX, y: e.clientY });
    const drag = dragRef.current;
    if (!drag || activePointers.current.size > 1) return;

    if (drag.kind === "pan") {
      drag.surface.scrollTop = drag.top - (e.clientY - drag.cy);
      drag.surface.scrollLeft = drag.left - (e.clientX - drag.cx);
      return;
    }
    if (drag.kind === "note") return;

    const wrapper = rootRef.current?.querySelector(`[data-page-wrapper="${drag.page}"]`) as HTMLElement | null;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const clamp = (v: number) => Math.min(Math.max(0, v), 1);

    if (drag.kind === "draw") {
      // Coalesced events keep a fast pen stroke smooth instead of polygonal at the frame rate.
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events.length ? events : [e.nativeEvent]) {
        pointsRef.current.push({ x: clamp((ev.clientX - rect.left) / rect.width), y: clamp((ev.clientY - rect.top) / rect.height) });
      }
      flushPreview(drag.page);
    } else if (drag.kind === "area") {
      const x = clamp((e.clientX - rect.left) / rect.width);
      const y = clamp((e.clientY - rect.top) / rect.height);
      const next = { x: Math.min(drag.startX, x), y: Math.min(drag.startY, y), w: Math.abs(x - drag.startX), h: Math.abs(y - drag.startY) };
      areaRef.current = next;
      setAreaPreview({ page: drag.page, rect: next });
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    activePointers.current.delete(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;
    cancelAnimationFrame(frame.current);

    if (drag?.kind === "draw" && pointsRef.current.length > 1) {
      createAnnotation(
        { id: newId(), type: "drawing", page: drag.page, color: pendingColor, selectedText: null, rects: [], points: pointsRef.current, comment: "", tags: [] },
        false
      );
      abort();
      return;
    }
    if (drag?.kind === "note") {
      if (Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) <= TAP_SLOP) {
        createAnnotation(
          { id: newId(), type: "note", page: drag.page, color: pendingColor, selectedText: null, rects: [{ x: drag.x, y: drag.y, w: 0, h: 0 }], points: null, comment: "", tags: [] },
          true
        );
      }
      abort();
      return;
    }
    // Presenting only ever leaves draw or highlight active (see onPointerDown);
    // the draw case is handled above, so anything left here is either a
    // highlight-in-progress (let it through) or view-only. The laser pointer
    // overrides both while active.
    if (presenting && (pointerActive || activeTool !== "highlight")) {
      abort();
      return;
    }
    const area = areaRef.current;
    if (drag?.kind === "area" && area && area.w > 0.005 && area.h > 0.005) {
      createAnnotation(
        { id: newId(), type: "area", page: drag.page, color: pendingColor, selectedText: null, rects: [area], points: null, comment: "", tags: [] },
        true
      );
      abort();
      return;
    }
    abort();
    if (drag?.kind === "pan") return;

    // Touch selections arrive through `selectionchange` (long-press + handles
    // never fire a usable pointerup), so only a mouse/pen release evaluates here.
    if (e.pointerType === "touch") return;

    // A plain click anywhere — on empty margin, another page, or just
    // clicking without dragging — collapses whatever selection the toolbar
    // was anchored to. Skip when the click is on the toolbar itself: its own
    // buttons already clear `pending` after acting, and clearing it here
    // first would unmount them out from under that click.
    const onToolbar = (e.target as HTMLElement | null)?.closest?.("[data-selection-toolbar]");
    const clearPendingUnlessOnToolbar = () => {
      if (selection.pending && !onToolbar) selection.setPending(null);
    };

    const found = pageWrapperAt(e.target);
    if (!found || activeTool === "note" || activeTool === "comment") {
      clearPendingUnlessOnToolbar();
      return;
    }
    const result = selection.evaluate();
    if (!result) {
      clearPendingUnlessOnToolbar();
      return;
    }

    if (activeTool === "highlight" || activeTool === "underline" || activeTool === "strikethrough") {
      createAnnotation(
        { id: newId(), type: activeTool, page: result.page, color: pendingColor, selectedText: result.text, rects: result.rects, points: null, comment: "", tags: [] },
        false
      );
      window.getSelection()?.removeAllRanges();
      return;
    }
    selection.setPending(result);
  }

  function onPointerCancel(e: ReactPointerEvent) {
    activePointers.current.delete(e.pointerId);
    abort();
  }

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave: () => setPointerPos(null) },
    drawPreview,
    areaPreview,
    pointerPos,
  };
}
