import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useDeviceProfile } from "@/pdf-reader/hooks/useDeviceProfile";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** "fill" is a tall sheet whose content manages its own scrolling (panels with tabs); "auto" hugs short content (menus, dialogs). */
  size?: "auto" | "fill";
  /** Hide the title row (the content brings its own header). */
  hideTitle?: boolean;
  /** Content padding. Panels that lay themselves out edge-to-edge pass false. */
  padded?: boolean;
};

// --- Android back button / iOS back swipe -----------------------------------
// A sheet is a "place" the user navigated into, so the system Back gesture
// should dismiss it rather than leave the whole reader. One history entry per
// open sheet; only the topmost sheet reacts to a pop.
const sheetStack: string[] = [];

function useSheetBackButton(id: string, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    let pushed = false;
    // Deferred so React StrictMode's mount/unmount/mount in dev never pushes (and orphans) an entry.
    const timer = setTimeout(() => {
      history.pushState({ sheet: id }, "");
      sheetStack.push(id);
      pushed = true;
    }, 0);
    const onPop = () => {
      if (sheetStack[sheetStack.length - 1] !== id) return;
      sheetStack.pop();
      pushed = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      if (pushed) {
        const at = sheetStack.lastIndexOf(id);
        if (at >= 0) sheetStack.splice(at, 1);
        if (history.state?.sheet === id) history.back();
      }
    };
  }, [id]);
}

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.6; // px/ms
const EXPAND_DISTANCE = 56;

export function BottomSheet({ title, onClose, children, size = "auto", hideTitle = false, padded = true }: Props) {
  const id = useId();
  const profile = useDeviceProfile();
  const sideDrawer = profile.form !== "phone" && profile.width >= 768;
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number } | null>(null);

  useSheetBackButton(id, onClose);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  function onHandleDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return; // the close button is still a button
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0 };
    setDragging(true);
  }
  function onHandleMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    setDragY(e.clientY - d.startY);
  }
  function onHandleUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const dy = dragY;
    setDragY(0);
    if (dy > DISMISS_DISTANCE || d.v > DISMISS_VELOCITY) {
      if (expanded) setExpanded(false);
      else onClose();
    } else if (dy < -EXPAND_DISTANCE && !expanded) setExpanded(true);
  }

  const heightStyle =
    size === "fill" ? { height: expanded ? "92dvh" : "68dvh" } : { maxHeight: expanded ? "92dvh" : "78dvh" };

  const header = (
    <div
      onPointerDown={sideDrawer ? undefined : onHandleDown}
      onPointerMove={sideDrawer ? undefined : onHandleMove}
      onPointerUp={sideDrawer ? undefined : onHandleUp}
      onPointerCancel={sideDrawer ? undefined : onHandleUp}
      className={`shrink-0 select-none ${sideDrawer ? "" : "touch-none"}`}
    >
      {!sideDrawer && (
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
      )}
      {!hideTitle && (
        <div className="flex items-center justify-between px-4 pb-2 pt-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" data-no-gesture="">
      <div
        className="absolute inset-0 animate-[sheet-fade_180ms_ease-out] bg-black/40"
        style={{ opacity: dragging ? Math.max(0.2, 1 - dragY / 500) : 1 }}
        onPointerDown={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute flex flex-col overflow-hidden bg-surface-elevated shadow-xl outline-none ${
          sideDrawer
            ? "inset-y-0 right-0 w-[min(28rem,45vw)] animate-[sheet-side_220ms_cubic-bezier(0.2,0.8,0.2,1)] border-l border-border"
            : "inset-x-0 bottom-0 animate-[sheet-up_240ms_cubic-bezier(0.2,0.8,0.2,1)] rounded-t-2xl border-t border-border"
        }`}
        style={{
          ...(sideDrawer
            ? { paddingTop: "var(--sat)", paddingBottom: "var(--sab)", paddingRight: "var(--sar)" }
            : { ...heightStyle, transform: dragY > 0 ? `translateY(${dragY}px)` : undefined, marginBottom: "var(--kb)", paddingLeft: "var(--sal)", paddingRight: "var(--sar)" }),
          transition: dragging ? "none" : "transform 180ms ease-out, height 200ms ease-out, max-height 200ms ease-out",
        }}
      >
        {header}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${padded ? "px-4 pt-1" : ""}`}
          style={{ paddingBottom: sideDrawer ? undefined : "var(--sab)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
