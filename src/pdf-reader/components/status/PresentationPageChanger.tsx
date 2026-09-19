import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/pdf-reader/components/common/IconButton";

const IDLE_HIDE_MS = 2500;

/**
 * The slideshow-style page changer for presentation mode: two buttons and an
 * editable page number, faded out of the way until the presenter needs it
 * (mouse over the bottom-center strip, or a page change from anywhere —
 * including the arrow-key shortcuts — briefly reveals it as feedback).
 */
export function PresentationPageChanger({
  currentPage,
  numPages,
  onNavigate,
}: {
  currentPage: number;
  numPages: number;
  onNavigate: (page: number) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const pageInputRef = useRef<HTMLInputElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (document.activeElement !== pageInputRef.current) setPageInput(String(currentPage));
  }, [currentPage]);

  function scheduleHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
  }

  function reveal() {
    setVisible(true);
    scheduleHide();
  }

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A page change from anywhere (arrow keys included) is worth a glance even
  // without the mouse ever touching this corner.
  useEffect(() => {
    reveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  function commitPageInput() {
    const n = Math.round(Number(pageInput));
    if (Number.isFinite(n)) onNavigate(Math.min(Math.max(1, n), numPages));
    else setPageInput(String(currentPage));
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-0 left-1/2 z-20 -translate-x-1/2 p-4"
      onMouseEnter={reveal}
      onMouseLeave={scheduleHide}
    >
      <div
        className={`flex items-center gap-1 rounded-full border border-border bg-surface-elevated/90 p-1 shadow-md backdrop-blur transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <IconButton label="Previous page" size="sm" disabled={currentPage <= 1} onClick={() => onNavigate(currentPage - 1)}>
          <ChevronLeft size={15} />
        </IconButton>
        <input
          ref={pageInputRef}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onFocus={reveal}
          onBlur={() => {
            commitPageInput();
            scheduleHide();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            commitPageInput();
            scheduleHide();
            e.currentTarget.blur();
          }}
          aria-label="Current page"
          className="w-9 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-center text-xs text-text-secondary focus-visible:border-border focus-visible:outline-2 focus-visible:outline-accent"
        />
        <span className="text-xs text-text-muted">/ {numPages}</span>
        <IconButton label="Next page" size="sm" disabled={currentPage >= numPages} onClick={() => onNavigate(currentPage + 1)}>
          <ChevronRight size={15} />
        </IconButton>
      </div>
    </div>
  );
}
