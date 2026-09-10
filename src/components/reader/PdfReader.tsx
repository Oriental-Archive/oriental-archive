"use client";

import { useImperativeHandle, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import type { ReaderApi, SubReaderProps } from "@/components/reader/ReaderShell";
import { Button } from "@/components/ui/Button";

// react-pdf bundles its own pdfjs-dist internally, whose PDFDocumentProxy
// type doesn't structurally match the separately-installed pdfjs-dist
// package (used only here for the worker URL) — so this is typed narrowly
// to just the two methods actually used, rather than importing either
// package's full (and mutually incompatible) proxy type.
type MinimalPdfDocument = { numPages: number; getPage: (n: number) => Promise<MinimalPdfPage> };
type MinimalPdfPage = { getTextContent: () => Promise<{ items: unknown[] }> };

// package.json pins pdfjs-dist to react-pdf's exact required version (no
// caret) on purpose: pdf.js refuses to run when its API version (react-pdf's
// bundled copy) and worker version (this import) don't match exactly, and
// react-pdf itself pins an exact version rather than a range. Bumping this
// package on its own will break the reader until it matches react-pdf again.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type HighlightData = { page: number; color: string; rects: Rect[] };
type Rect = { x: number; y: number; w: number; h: number };
type PdfLocation = { page: number };

// Not `withCredentials: true`: the file endpoint redirects to a cross-origin
// signed URL, and S3-style CORS has no way to grant
// Access-Control-Allow-Credentials — forcing credentials mode "include" would
// make the browser require that header and fail. The default already sends
// cookies on the same-origin first hop, which is all the endpoint needs.
const DOCUMENT_OPTIONS = { withCredentials: false };

export function PdfReader({ fileUrl, annotations, onCreate, apiRef }: SubReaderProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    rects: Rect[];
    anchor: { x: number; y: number };
  } | null>(null);

  const pdfRef = useRef<MinimalPdfDocument | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const textCacheRef = useRef<Map<number, string>>(new Map());

  useImperativeHandle(apiRef, (): ReaderApi => ({
    jumpTo: (location) => {
      const page = (location as PdfLocation)?.page;
      if (page) {
        setCurrentPage(page);
        setPageInput(String(page));
      }
    },
  }));

  function goToPage(n: number) {
    if (!numPages) return;
    const clamped = Math.min(Math.max(1, n), numPages);
    setCurrentPage(clamped);
    setPageInput(String(clamped));
  }

  function handleMouseUp() {
    const selection = window.getSelection();
    const container = pageContainerRef.current;
    if (!selection || selection.isCollapsed || !container || selection.toString().trim() === "") {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    const containerRect = container.getBoundingClientRect();
    const rects: Rect[] = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - containerRect.left) / containerRect.width,
        y: (r.top - containerRect.top) / containerRect.height,
        w: r.width / containerRect.width,
        h: r.height / containerRect.height,
      }));
    if (rects.length === 0) return;

    const last = rects[rects.length - 1];
    setPendingSelection({
      text: selection.toString(),
      rects,
      anchor: { x: (last.x + last.w) * containerRect.width, y: last.y * containerRect.height },
    });
  }

  async function confirmHighlight() {
    if (!pendingSelection) return;
    const highlightData: HighlightData = {
      page: currentPage,
      color: "gold",
      rects: pendingSelection.rects,
    };
    const ok = await onCreate({
      location: { page: currentPage } satisfies PdfLocation,
      selectedText: pendingSelection.text,
      highlightData,
    });
    // Left in place on failure (with the sidebar's error message explaining
    // why) so the same selection can be retried without re-selecting text.
    if (!ok) return;
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
  }

  async function addBookmark() {
    await onCreate({ location: { page: currentPage } satisfies PdfLocation });
  }

  async function runSearch() {
    const pdf = pdfRef.current;
    if (!pdf || !searchQuery.trim()) return;
    setSearching(true);
    const query = searchQuery.trim().toLowerCase();
    const matches: number[] = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        let text = textCacheRef.current.get(n);
        if (text === undefined) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text = content.items
            .map((item) => (typeof (item as { str?: unknown }).str === "string" ? (item as { str: string }).str : ""))
            .join(" ");
          textCacheRef.current.set(n, text);
        }
        if (text.toLowerCase().includes(query)) matches.push(n);
      }
      setSearchResults(matches);
    } catch {
      // A single unreadable page (corrupted content stream, etc.) would
      // otherwise throw mid-loop and leave the Search button stuck reading
      // "…" forever, with whatever pages were already scanned lost.
      setSearchResults(matches);
    } finally {
      setSearching(false);
    }
  }

  const currentPageHighlights = useMemo(
    () =>
      annotations.filter((a) => {
        // Array.isArray guards against foreign-format highlight data (e.g.
        // leftover data for the same book id but a different document
        // format) reaching the .rects.map() below.
        const h = a.highlightData as Partial<HighlightData> | null | undefined;
        return h?.page === currentPage && Array.isArray(h.rects);
      }),
    [annotations, currentPage]
  );

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        currentPage={currentPage}
        numPages={numPages}
        pageInput={pageInput}
        onPageInputChange={setPageInput}
        onPageInputCommit={() => goToPage(Number(pageInput) || 1)}
        onPrev={() => goToPage(currentPage - 1)}
        onNext={() => goToPage(currentPage + 1)}
        scale={scale}
        onZoomOut={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}
        onZoomIn={() => setScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={runSearch}
        searching={searching}
        searchResults={searchResults}
        onJumpToResult={goToPage}
        onBookmark={addBookmark}
      />

      <div className="flex-1 overflow-auto bg-navy/90 p-6">
        <div className="flex justify-center">
          <div ref={pageContainerRef} onMouseUp={handleMouseUp} className="relative inline-block bg-surface shadow-lg">
            <Document
              file={fileUrl}
              options={DOCUMENT_OPTIONS}
              onLoadSuccess={(pdf) => {
                pdfRef.current = pdf;
                setNumPages(pdf.numPages);
              }}
              loading={<PdfPlaceholder>Loading document…</PdfPlaceholder>}
              error={<PdfPlaceholder>Couldn&apos;t load this document.</PdfPlaceholder>}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderAnnotationLayer={false}
                loading={<PdfPlaceholder>Loading page…</PdfPlaceholder>}
              />
            </Document>

            {currentPageHighlights.map((a) => {
              const h = a.highlightData as HighlightData;
              return h.rects.map((r, i) => (
                <div
                  key={`${a.id}-${i}`}
                  className="pointer-events-none absolute bg-gold/35"
                  style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                />
              ));
            })}

            {pendingSelection && (
              <button
                type="button"
                onClick={confirmHighlight}
                className="absolute z-10 rounded-sm bg-navy px-2 py-1 text-xs text-background shadow-md hover:bg-burgundy"
                style={{ left: pendingSelection.anchor.x, top: pendingSelection.anchor.y }}
              >
                Highlight
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PdfPlaceholder({ children }: { children: React.ReactNode }) {
  return <div className="p-10 text-center text-sm text-muted">{children}</div>;
}

function Toolbar(props: {
  currentPage: number;
  numPages: number | null;
  pageInput: string;
  onPageInputChange: (v: string) => void;
  onPageInputCommit: () => void;
  onPrev: () => void;
  onNext: () => void;
  scale: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchResults: number[] | null;
  onJumpToResult: (page: number) => void;
  onBookmark: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-navy px-4 py-2 text-background">
      <div className="flex items-center gap-1">
        <Button variant="toolbar" onClick={props.onPrev}>
          ‹ Prev
        </Button>
        <input
          value={props.pageInput}
          onChange={(e) => props.onPageInputChange(e.target.value)}
          onBlur={props.onPageInputCommit}
          onKeyDown={(e) => e.key === "Enter" && props.onPageInputCommit()}
          className="w-12 rounded-sm border border-white/20 bg-transparent px-1 py-1 text-center text-xs"
        />
        <span className="text-xs text-background/70">/ {props.numPages ?? "…"}</span>
        <Button variant="toolbar" onClick={props.onNext}>
          Next ›
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="toolbar" onClick={props.onZoomOut}>
          −
        </Button>
        <span className="w-10 text-center text-xs">{Math.round(props.scale * 100)}%</span>
        <Button variant="toolbar" onClick={props.onZoomIn}>
          +
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSearch();
        }}
        className="flex items-center gap-1"
      >
        <input
          value={props.searchQuery}
          onChange={(e) => props.onSearchQueryChange(e.target.value)}
          placeholder="Search in document…"
          className="w-40 rounded-sm border border-white/20 bg-transparent px-2 py-1 text-xs placeholder:text-background/50"
        />
        <Button type="submit" variant="toolbar">
          {props.searching ? "…" : "Search"}
        </Button>
      </form>
      {props.searchResults && (
        <div className="flex items-center gap-1 text-xs">
          {props.searchResults.length === 0 ? (
            <span className="text-background/70">No matches</span>
          ) : (
            props.searchResults.slice(0, 8).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => props.onJumpToResult(p)}
                className="rounded-sm border border-gold px-1.5 py-0.5 hover:bg-gold hover:text-navy"
              >
                p.{p}
              </button>
            ))
          )}
        </div>
      )}

      <Button variant="toolbar" className="ml-auto" onClick={props.onBookmark}>
        Bookmark this page
      </Button>
    </div>
  );
}
