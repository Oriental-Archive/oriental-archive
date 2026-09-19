import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PendingSelection } from "@/pdf-reader/types";

const SETTLE_MS = 220;
const TOOLBAR_GUARD_MS = 900;

/**
 * Turns the browser's native selection into a `pending` selection our toolbar
 * can act on. Driven by `selectionchange` rather than mouseup because on a
 * touch screen a long-press selection and its drag handles never fire
 * mouseup at all — which is why the toolbar previously never appeared on a
 * phone. The mouse path still evaluates immediately on release (see
 * `evaluate`), so desktop behavior is unchanged.
 */
export function useTextSelection(rootRef: RefObject<HTMLElement | null>) {
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const mouseDownRef = useRef(false);
  const guardUntilRef = useRef(0);
  const lastPointerType = useRef<string>("mouse");

  const evaluate = useCallback((): PendingSelection | null => {
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0 || sel.toString().trim() === "") return null;
    const range = sel.getRangeAt(0);
    const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement;
    const wrapper = start?.closest?.("[data-page-wrapper]") as HTMLElement | null;
    if (!wrapper || !root.contains(wrapper) || !wrapper.contains(range.commonAncestorContainer)) return null;
    const box = wrapper.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      }));
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    return {
      text: sel.toString(),
      rects,
      page: Number(wrapper.dataset.pageWrapper),
      anchor: {
        x: (left + right) / 2,
        top: Math.min(...rects.map((r) => r.y)),
        bottom: Math.max(...rects.map((r) => r.y + r.h)),
      },
    };
  }, [rootRef]);

  /** True while a tap on our own toolbar could be collapsing the selection out from under its click. */
  const toolbarGuardActive = useCallback(() => performance.now() < guardUntilRef.current, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    function onSelectionChange() {
      if (mouseDownRef.current) return; // mid-drag: wait for release
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const next = evaluate();
        if (next) setPending(next);
        else if (!toolbarGuardActive()) setPending(null);
      }, SETTLE_MS);
    }
    function onPointerDown(e: PointerEvent) {
      lastPointerType.current = e.pointerType;
      if (e.pointerType === "mouse") mouseDownRef.current = true;
      if ((e.target as Element | null)?.closest?.("[data-selection-toolbar]")) guardUntilRef.current = performance.now() + TOOLBAR_GUARD_MS;
    }
    function onPointerEnd(e: PointerEvent) {
      if (e.pointerType === "mouse") mouseDownRef.current = false;
      if ((e.target as Element | null)?.closest?.("[data-selection-toolbar]")) guardUntilRef.current = performance.now() + TOOLBAR_GUARD_MS;
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
    };
  }, [evaluate, toolbarGuardActive]);

  return { pending, setPending, evaluate, toolbarGuardActive, lastPointerType };
}
