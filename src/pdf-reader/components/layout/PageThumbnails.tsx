import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import { useElementSize } from "@/pdf-reader/hooks/useElementSize";

const THUMB_WIDTH = 108;
const GAP = 14;
const COL_GAP = 12;
const PAD = 12;

export function PageThumbnails({
  pdf,
  numPages,
  currentPage,
  rotation,
  flipVertical,
  onSelect,
  columns = 1,
}: {
  pdf: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  onSelect: (page: number) => void;
  /** 1 is the desktop list; phones use a grid so a screen shows a dozen pages instead of three. */
  columns?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const [aspect, setAspect] = useState(1.294); // US Letter default until page 1 is measured
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    let cancelled = false;
    pdf.getPage(1).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale: 1, rotation });
      setAspect(vp.height / vp.width);
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, rotation]);

  const thumbWidth =
    columns === 1 ? THUMB_WIDTH : Math.max(60, Math.floor((size.width - PAD * 2 - COL_GAP * (columns - 1)) / columns));
  const thumbHeight = thumbWidth * aspect;
  const rowHeight = thumbHeight + 30 + GAP; // + label + gap
  const rows = Math.ceil(numPages / columns);
  const gridWidth = columns * thumbWidth + (columns - 1) * COL_GAP;

  // Keep the current page's thumbnail in view when it changes from outside
  // (page navigation elsewhere), without fighting the user's own scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !size.height) return;
    const top = Math.floor((currentPage - 1) / columns) * rowHeight;
    if (top < el.scrollTop || top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 2 + rowHeight / 2), behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, size.height, rowHeight]);

  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const lastRow = Math.min(rows - 1, Math.ceil((scrollTop + (size.height || 600)) / rowHeight) + 2);
  const pages: number[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    for (let c = 0; c < columns; c++) {
      const p = r * columns + c + 1;
      if (p <= numPages) pages.push(p);
    }
  }

  return (
    <div ref={containerRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="h-full overflow-auto overscroll-contain p-3">
      <div className="relative mx-auto" style={{ height: rows * rowHeight, width: gridWidth }}>
        {pages.map((p) => {
          const row = Math.floor((p - 1) / columns);
          const col = (p - 1) % columns;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              aria-label={`Page ${p}`}
              className="absolute flex flex-col items-center gap-1"
              style={{ top: row * rowHeight, left: col * (thumbWidth + COL_GAP), width: thumbWidth }}
            >
              <div
                className={`overflow-hidden rounded-sm border shadow-sm transition-colors ${
                  p === currentPage ? "border-accent ring-2 ring-accent/40" : "border-border-strong hover:border-text-muted"
                }`}
                style={{ width: thumbWidth, height: thumbHeight, background: "white" }}
              >
                <Thumbnail
                  pdf={pdf}
                  pageNumber={p}
                  width={thumbWidth}
                  height={thumbHeight}
                  rotation={rotation}
                  flipVertical={flipVertical}
                />
              </div>
              <span className={`text-[11px] ${p === currentPage ? "font-medium text-accent" : "text-text-muted"}`}>{p}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const Thumbnail = memo(function Thumbnail({
  pdf,
  pageNumber,
  width,
  height,
  rotation,
  flipVertical,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1, rotation });
      const scale = width / baseViewport.width;
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvas, canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      try {
        await task.promise;
      } catch {
        // cancelled — expected while scrolling fast
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      // Thumbnails scroll past by the hundred; don't let their backing stores pile up.
      if (canvasRef.current) canvasRef.current.width = canvasRef.current.height = 0;
    };
  }, [pdf, pageNumber, width, rotation]);

  return <canvas ref={canvasRef} style={{ width, height, transform: flipVertical ? "scaleY(-1)" : undefined }} />;
});
