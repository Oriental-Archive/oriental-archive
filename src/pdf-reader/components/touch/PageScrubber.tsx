import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import { Thumbnail } from "@/pdf-reader/components/layout/PageThumbnails";

const PREVIEW_W = 84;

/**
 * An ebook-style progress scrubber: drag anywhere along the track to move
 * through the whole document, with a thumbnail + chapter preview above the
 * thumb. Navigation happens on release, so scrubbing through hundreds of
 * pages never renders more than a tiny preview.
 */
export function PageScrubber({
  page,
  numPages,
  onSeek,
  onScrubbingChange,
  pdf,
  pageAspect,
  rotation,
  flipVertical,
  chapterOf,
}: {
  page: number;
  numPages: number;
  onSeek: (page: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  pdf: PDFDocumentProxy;
  pageAspect: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  chapterOf: (page: number) => string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  // The thumbnail lags the label by a beat so a fast drag renders only where it settles.
  const [thumbPage, setThumbPage] = useState<number | null>(null);

  useEffect(() => {
    if (preview === null) {
      setThumbPage(null);
      return;
    }
    const t = setTimeout(() => setThumbPage(preview), 70);
    return () => clearTimeout(t);
  }, [preview]);

  const shown = preview ?? page;
  const frac = numPages > 1 ? (shown - 1) / (numPages - 1) : 0;

  function pageAt(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || numPages <= 1) return 1;
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(f * (numPages - 1)) + 1;
  }

  function onDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPreview(pageAt(e.clientX));
    onScrubbingChange?.(true);
  }
  function onMove(e: React.PointerEvent) {
    if (preview === null) return;
    setPreview(pageAt(e.clientX));
  }
  function onUp(e: React.PointerEvent) {
    if (preview === null) return;
    const target = pageAt(e.clientX);
    setPreview(null);
    onScrubbingChange?.(false);
    if (target !== page) onSeek(target);
  }
  function onKey(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? -10 : e.key === "PageDown" ? 10 : 0;
    if (step) {
      e.preventDefault();
      onSeek(Math.min(numPages, Math.max(1, page + step)));
    } else if (e.key === "Home") onSeek(1);
    else if (e.key === "End") onSeek(numPages);
  }

  const chapter = preview !== null ? chapterOf(preview) : null;
  const previewH = Math.round(PREVIEW_W * pageAspect);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Page"
      aria-valuemin={1}
      aria-valuemax={numPages}
      aria-valuenow={shown}
      aria-valuetext={`Page ${shown} of ${numPages}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        setPreview(null);
        onScrubbingChange?.(false);
      }}
      onKeyDown={onKey}
      className="relative flex h-11 flex-1 touch-none items-center outline-none focus-visible:[&>div]:ring-2 focus-visible:[&>div]:ring-accent"
    >
      <div ref={trackRef} className="relative h-[3px] w-full rounded-full bg-border-strong">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${frac * 100}%` }} />
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow transition-[width,height] ${
            preview !== null ? "h-5 w-5" : "h-3.5 w-3.5"
          }`}
          style={{ left: `${frac * 100}%` }}
        />
      </div>

      {preview !== null && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-lg border border-border bg-surface-elevated p-1.5 shadow-lg"
          style={{ left: `clamp(${PREVIEW_W / 2 + 8}px, ${frac * 100}%, calc(100% - ${PREVIEW_W / 2 + 8}px))`, maxWidth: 200 }}
        >
          <div className="overflow-hidden rounded-sm border border-border bg-white" style={{ width: PREVIEW_W, height: previewH }}>
            {thumbPage !== null && (
              <Thumbnail pdf={pdf} pageNumber={thumbPage} width={PREVIEW_W} height={previewH} rotation={rotation} flipVertical={flipVertical} />
            )}
          </div>
          <span className="text-[12px] font-medium tabular-nums text-text-primary">Page {preview}</span>
          {chapter && <span className="line-clamp-2 max-w-[180px] text-center text-[10.5px] leading-tight text-text-muted">{chapter}</span>}
        </div>
      )}
    </div>
  );
}
