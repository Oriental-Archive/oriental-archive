import { memo, useEffect, useRef, useState } from "react";
import { TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "@/pdf-reader/lib/pdf";
import type { PdfAppearance, Rect } from "@/pdf-reader/types";
import { findMatchRects } from "@/pdf-reader/lib/textLayerSearch";

type LinkAnnotation = { rect: Rect; destPage: number };

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  appearance: PdfAppearance;
  searchQuery: string;
  searchCaseSensitive: boolean;
  searchWholeWord: boolean;
  /** Which occurrence on this page (0-indexed, left-to-right/top-to-bottom) is the active search result. */
  activeMatchOrdinal: number | null;
  onNaturalSize: (pageNumber: number, size: { width: number; height: number }) => void;
  onInternalLink: (destPage: number) => void;
  /** Wait this long before starting to rasterize — lets the page the user is actually looking at claim the worker first. */
  deferMs?: number;
};

const APPEARANCE_FILTER: Record<PdfAppearance, string> = {
  original: "none",
  dimmed: "brightness(0.82) contrast(0.96)",
  inverted: "invert(1) hue-rotate(180deg)",
};

// iOS Safari silently refuses (or blanks) canvases above ~16.7M pixels, and
// a single full-resolution page at high zoom on a 3x phone blows past that.
// Cap the backing store instead of the zoom: the page is a little softer at
// extreme zoom, but it always draws.
const MAX_CANVAS_PIXELS = 16_000_000;
const MAX_DPR = 3;

function pickOutputScale(cssWidth: number, cssHeight: number): number {
  let out = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const area = cssWidth * cssHeight;
  if (area * out * out > MAX_CANVAS_PIXELS) out = Math.sqrt(MAX_CANVAS_PIXELS / area);
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Centers `el` inside the reader's nearest scroll surface. Deliberately not
// scrollIntoView(): that walks every scrollable ancestor, including the
// page-turn strip's overflow:hidden track, and would slide it out of place.
function revealInSurface(el: HTMLElement) {
  const surface = el.closest<HTMLElement>("[data-scroll-surface]");
  if (!surface) return;
  const s = surface.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // Aim a little above true center so bottom chrome never sits on the match.
  const dy = r.top + r.height / 2 - (s.top + s.height * 0.4);
  const dx = r.left + r.width / 2 - (s.left + s.width / 2);
  surface.scrollBy({ top: dy, left: dx, behavior: "auto" });
}

// Canvas + text-layer rendering only. Memoized against its own render-affecting
// props (pdf/page/scale/rotation/appearance) so highlight/annotation state
// elsewhere in the tree never re-triggers a rasterization — that separation
// is what makes highlighting instant. searchQuery/activeMatchRect changes do
// re-run this component, but only the lightweight "scan already-rendered
// text nodes" effect below, never the canvas render effect.
//
// Fills its parent (`absolute inset-0`): the parent owns the page's size, so
// a zoom change resizes the page instantly while the previous bitmap keeps
// showing (stretched) until the sharp one is ready.
export const PdfPage = memo(function PdfPage({
  pdf,
  pageNumber,
  scale,
  rotation,
  flipVertical,
  appearance,
  searchQuery,
  searchCaseSensitive,
  searchWholeWord,
  activeMatchOrdinal,
  onNaturalSize,
  onInternalLink,
  deferMs = 0,
}: Props) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const searchLayerRef = useRef<HTMLDivElement>(null);
  const linkLayerRef = useRef<HTMLDivElement>(null);
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
  const pageProxyRef = useRef<PDFPageProxy | null>(null);
  const revealedKeyRef = useRef<string | null>(null);
  const onInternalLinkRef = useRef(onInternalLink);
  onInternalLinkRef.current = onInternalLink;
  // Bumped once the text layer is actually ready. Without this, a search
  // already active when a new page mounts loses the race: the highlight
  // effect below fires on mount (before the async render effect has set
  // textLayerInstanceRef) and, since the query itself never changes again,
  // never gets another chance to run.
  const [textLayerVersion, setTextLayerVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: TextLayer | null = null;

    (async () => {
      if (deferMs > 0) {
        await sleep(deferMs);
        if (cancelled) return;
      }
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      pageProxyRef.current = page;

      const natural = page.getViewport({ scale: 1, rotation });
      onNaturalSize(pageNumber, { width: natural.width, height: natural.height });

      const viewport = page.getViewport({ scale, rotation });
      const host = canvasHostRef.current;
      const textLayerEl = textLayerRef.current;
      if (!host || !textLayerEl) return;

      // Draw into a fresh offscreen canvas and only swap it in once it's
      // complete. Resizing the live canvas would wipe it to transparent and
      // flash blank for the whole render.
      const outputScale = pickOutputScale(viewport.width, viewport.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.cssText = "display:block;width:100%;height:100%";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTask = task;
      try {
        await task.promise;
      } catch {
        canvas.width = canvas.height = 0;
        return; // expected when a page/scale/rotation change cancels a render
      }
      if (cancelled) {
        canvas.width = canvas.height = 0;
        return;
      }
      const previous = host.firstElementChild as HTMLCanvasElement | null;
      host.replaceChildren(canvas);
      if (previous) previous.width = previous.height = 0; // free the old backing store now, not at GC time

      textLayerEl.style.setProperty("--total-scale-factor", String(scale));
      textLayerEl.style.width = `${viewport.width}px`;
      textLayerEl.style.height = `${viewport.height}px`;
      textLayerEl.replaceChildren();

      const textContent = await page.getTextContent();
      if (cancelled) return;
      textLayer = new TextLayer({ textContentSource: textContent, container: textLayerEl, viewport });
      textLayerInstanceRef.current = textLayer;
      await textLayer.render();
      if (cancelled) return;
      setTextLayerVersion((v) => v + 1);

      // Internal links (footnotes, cross-references, TOC-style jumps) get a
      // clickable overlay; external URLs are left alone for now.
      const annotations = (await page.getAnnotations().catch(() => [])) as Array<{
        subtype?: string;
        rect?: number[];
        dest?: string | unknown[] | null;
      }>;
      if (cancelled || !linkLayerRef.current) return;
      const links: LinkAnnotation[] = [];
      for (const a of annotations) {
        if (a.subtype !== "Link" || !a.dest || !a.rect) continue;
        try {
          const dest = typeof a.dest === "string" ? await pdf.getDestination(a.dest) : (a.dest as unknown[]);
          const ref = Array.isArray(dest) ? dest[0] : null;
          if (!ref) continue;
          const destPage = (await pdf.getPageIndex(ref)) + 1;
          const [x1, y1] = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
          const [x2, y2] = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
          links.push({
            destPage,
            rect: {
              x: Math.min(x1, x2) / viewport.width,
              y: Math.min(y1, y2) / viewport.height,
              w: Math.abs(x2 - x1) / viewport.width,
              h: Math.abs(y2 - y1) / viewport.height,
            },
          });
        } catch {
          // Unresolvable destination — skip rather than break the page.
        }
      }
      if (!cancelled) renderLinkLayer(linkLayerRef.current, links, onInternalLinkRef);
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNumber, scale, rotation]);

  // Release GPU/worker memory as soon as the page leaves the render window —
  // on a phone, hundreds of retained canvases are what turns a long book into
  // a crash. Safari in particular holds canvas memory until GC unless the
  // backing store is zeroed explicitly.
  useEffect(() => {
    const host = canvasHostRef.current;
    return () => {
      const canvas = host?.firstElementChild as HTMLCanvasElement | null;
      if (canvas) canvas.width = canvas.height = 0;
      host?.replaceChildren();
      textLayerInstanceRef.current = null;
      pageProxyRef.current?.cleanup();
      pageProxyRef.current = null;
    };
  }, [pdf, pageNumber]);

  useEffect(() => {
    const textLayer = textLayerInstanceRef.current;
    const container = textLayerRef.current;
    const searchLayer = searchLayerRef.current;
    if (!textLayer || !container || !searchLayer) return;
    if (!searchQuery.trim()) {
      searchLayer.replaceChildren();
      revealedKeyRef.current = null;
      return;
    }
    const groups = findMatchRects(textLayer, container, searchQuery, {
      caseSensitive: searchCaseSensitive,
      wholeWord: searchWholeWord,
    });
    searchLayer.replaceChildren();
    let activeEl: HTMLElement | null = null;
    groups.forEach((rects, ordinal) => {
      const isActive = ordinal === activeMatchOrdinal;
      for (const r of rects) {
        const el = document.createElement("div");
        el.className = isActive
          ? "absolute rounded-[2px] bg-warning/60 ring-1 ring-warning"
          : "absolute rounded-[2px] bg-warning/30";
        el.style.left = `${r.x * 100}%`;
        el.style.top = `${r.y * 100}%`;
        el.style.width = `${r.w * 100}%`;
        el.style.height = `${r.h * 100}%`;
        searchLayer.appendChild(el);
        if (isActive && !activeEl) activeEl = el;
      }
    });
    // Bring a *newly* active match into view, once. Keyed so a later re-run of
    // this effect (zoom, rotation) doesn't yank the reader back to the match.
    const key = `${searchQuery}|${searchCaseSensitive}|${searchWholeWord}|${pageNumber}|${activeMatchOrdinal}`;
    if (activeEl && revealedKeyRef.current !== key) {
      revealedKeyRef.current = key;
      revealInSurface(activeEl);
    } else if (!activeEl) {
      revealedKeyRef.current = null;
    }
    // Re-run whenever the rendered text layer for this page changes too
    // (scale/rotation/page), so matches stay aligned; that's covered by the
    // outer effect re-mounting this one via the searchLayer ref changing.
    // textLayerVersion covers the case where this effect's first attempt
    // fired before the text layer existed yet (see the comment by its ref).
  }, [searchQuery, searchCaseSensitive, searchWholeWord, activeMatchOrdinal, pageNumber, scale, rotation, textLayerVersion]);

  return (
    <div
      className="absolute inset-0"
      style={{ filter: APPEARANCE_FILTER[appearance], transform: flipVertical ? "scaleY(-1)" : undefined }}
    >
      <div ref={canvasHostRef} className="absolute inset-0" />
      <div ref={textLayerRef} className="textLayer" />
      <div ref={searchLayerRef} className="pointer-events-none absolute inset-0" />
      {/* pointer-events-none here matters even on pages with no links: an
          empty absolutely-positioned div still eats every mousedown by
          default, which silently kills native text selection underneath
          it — see the matching note in AnnotationLayer. */}
      <div ref={linkLayerRef} className="pointer-events-none absolute inset-0" />
    </div>
  );
});

function renderLinkLayer(
  layer: HTMLDivElement,
  links: LinkAnnotation[],
  onInternalLinkRef: React.RefObject<(destPage: number) => void>
) {
  layer.replaceChildren();
  for (const link of links) {
    const el = document.createElement("button");
    el.type = "button";
    el.setAttribute("aria-label", `Go to page ${link.destPage}`);
    el.setAttribute("data-annotation-mark", "");
    el.className = "pointer-events-auto absolute cursor-pointer rounded-[2px] hover:bg-accent/10";
    el.style.left = `${link.rect.x * 100}%`;
    el.style.top = `${link.rect.y * 100}%`;
    el.style.width = `${link.rect.w * 100}%`;
    el.style.height = `${link.rect.h * 100}%`;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      onInternalLinkRef.current(link.destPage);
    });
    layer.appendChild(el);
  }
}
