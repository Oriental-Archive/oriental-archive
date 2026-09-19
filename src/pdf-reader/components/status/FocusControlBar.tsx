import { ChevronLeft, ChevronRight, Minus, Plus, Highlighter, X } from "lucide-react";

export function FocusControlBar({
  currentPage,
  numPages,
  onPrev,
  onNext,
  scale,
  onZoomIn,
  onZoomOut,
  annotationsVisible,
  onToggleAnnotations,
  onExit,
}: {
  currentPage: number;
  numPages: number | null;
  onPrev: () => void;
  onNext: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  annotationsVisible: boolean;
  onToggleAnnotations: () => void;
  onExit: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface-elevated px-2 py-1.5 shadow-lg">
      <button type="button" onClick={onPrev} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover">
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-[3.5rem] text-center text-xs text-text-secondary">
        {currentPage}
        {numPages ? ` / ${numPages}` : ""}
      </span>
      <button type="button" onClick={onNext} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover">
        <ChevronRight size={15} />
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover">
        <Minus size={14} />
      </button>
      <span className="w-9 text-center text-xs text-text-secondary">{Math.round(scale * 100)}%</span>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover">
        <Plus size={14} />
      </button>
      <div className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={onToggleAnnotations}
        aria-pressed={annotationsVisible}
        aria-label="Toggle annotations"
        className={`flex h-7 w-7 items-center justify-center rounded-full ${annotationsVisible ? "text-accent" : "text-text-muted"} hover:bg-surface-hover`}
      >
        <Highlighter size={14} />
      </button>
      <button type="button" onClick={onExit} aria-label="Exit focus mode" className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-hover">
        <X size={15} />
      </button>
    </div>
  );
}
