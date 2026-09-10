"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as mammoth from "mammoth";
import DOMPurify from "dompurify";
import type { ReaderApi, SubReaderProps } from "@/components/reader/ReaderShell";
import { Button } from "@/components/ui/Button";

type Rect = { x: number; y: number; w: number; h: number };
type DocxHighlightData = { color: string; rects: Rect[] };
type DocxLocation = { scrollFraction: number };

const FONT_STEPS = [80, 90, 100, 110, 125, 140, 160];

// DOCX must never be dumped as raw content (spec §8): mammoth converts it to
// semantic HTML client-side (the original .docx is never touched — it stays
// exactly as uploaded in storage), and DOMPurify sanitizes that HTML before
// it's ever rendered, since a DOCX is attacker-controllable content (spec
// §34) and mammoth's output is not guaranteed safe by construction.
//
// Highlighting uses the same viewport-rect technique as the PDF reader
// rather than epub.js-style structural references, because there's no
// established addressing scheme for converted DOCX content. That means a
// highlight can drift if the browser window is resized enough to reflow the
// text — an accepted limitation for this format, not present in the PDF or
// EPUB readers.
export function DocxReader({ fileUrl, annotations, onCreate, apiRef }: SubReaderProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fontStepIndex, setFontStepIndex] = useState(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[] | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ text: string; rects: Rect[] } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(apiRef, (): ReaderApi => ({
    jumpTo: (location) => {
      const frac = (location as DocxLocation)?.scrollFraction;
      const el = scrollRef.current;
      if (frac !== undefined && el) {
        el.scrollTop = frac * (el.scrollHeight - el.clientHeight);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    // Default ("same-origin") credentials mode already sends the session
    // cookie on this endpoint's same-origin first hop; "include" would
    // additionally demand the redirect target (a cross-origin signed R2 URL)
    // grant Access-Control-Allow-Credentials, which S3-style CORS can't do.
    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch document");
        return res.arrayBuffer();
      })
      .then((buffer) => mammoth.convertToHtml({ arrayBuffer: buffer }))
      .then((result) => {
        if (!cancelled) setHtml(DOMPurify.sanitize(result.value));
      })
      .catch(() => {
        // A network drop, an HTTP error, or a corrupted/unparseable DOCX
        // (mammoth throwing) previously left this stuck on "Loading
        // document…" forever with no way to know it had failed.
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  function handleMouseUp() {
    const selection = window.getSelection();
    const content = contentRef.current;
    if (!selection || selection.isCollapsed || !content || selection.toString().trim() === "") {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) return;

    const contentRect = content.getBoundingClientRect();
    const rects: Rect[] = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - contentRect.left) / contentRect.width,
        y: (r.top - contentRect.top) / contentRect.height,
        w: r.width / contentRect.width,
        h: r.height / contentRect.height,
      }));
    if (rects.length > 0) setPendingSelection({ text: selection.toString(), rects });
  }

  async function confirmHighlight() {
    if (!pendingSelection) return;
    const highlightData: DocxHighlightData = { color: "gold", rects: pendingSelection.rects };
    const ok = await onCreate({ location: currentScrollLocation(), selectedText: pendingSelection.text, highlightData });
    // Left in place on failure (with the sidebar's error message explaining
    // why) so the same selection can be retried without re-selecting text.
    if (!ok) return;
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
  }

  function currentScrollLocation(): DocxLocation {
    const el = scrollRef.current;
    const range = el ? el.scrollHeight - el.clientHeight : 0;
    return { scrollFraction: el && range > 0 ? el.scrollTop / range : 0 };
  }

  async function addBookmark() {
    await onCreate({ location: currentScrollLocation() });
  }

  function runSearch() {
    const content = contentRef.current;
    const query = searchQuery.trim().toLowerCase();
    if (!content || !query) return;

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const matches: number[] = [];
    let node: Text | null;
    let index = 0;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.data.toLowerCase();
      let pos = text.indexOf(query);
      while (pos !== -1) {
        matches.push(index);
        pos = text.indexOf(query, pos + 1);
      }
      index++;
    }
    setSearchResults(matches);
  }

  function jumpToTextNodeIndex(targetIndex: number) {
    const content = contentRef.current;
    if (!content) return;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    let index = 0;
    while ((node = walker.nextNode() as Text | null)) {
      if (index === targetIndex) {
        node.parentElement?.scrollIntoView({ block: "center" });
        return;
      }
      index++;
    }
  }

  const highlights = useMemo(
    () =>
      annotations.filter((a) => {
        // Array.isArray guards against foreign-format highlight data (e.g.
        // leftover data for the same book id but a different document
        // format) reaching the .rects.map() below.
        const h = a.highlightData as Partial<DocxHighlightData> | null | undefined;
        return h != null && Array.isArray(h.rects);
      }),
    [annotations]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-navy px-4 py-2 text-background">
        <div className="flex items-center gap-1">
          <Button variant="toolbar" onClick={() => setFontStepIndex((i) => Math.max(0, i - 1))}>
            A−
          </Button>
          <span className="w-10 text-center text-xs">{FONT_STEPS[fontStepIndex]}%</span>
          <Button
            variant="toolbar"
            onClick={() => setFontStepIndex((i) => Math.min(FONT_STEPS.length - 1, i + 1))}
          >
            A+
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex items-center gap-1"
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in document…"
            className="w-40 rounded-sm border border-white/20 bg-transparent px-2 py-1 text-xs placeholder:text-background/50"
          />
          <Button type="submit" variant="toolbar">
            Search
          </Button>
        </form>
        {searchResults && (
          <div className="flex items-center gap-1 text-xs">
            {searchResults.length === 0 ? (
              <span className="text-background/70">No matches</span>
            ) : (
              searchResults.slice(0, 8).map((idx, i) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => jumpToTextNodeIndex(idx)}
                  className="rounded-sm border border-gold px-1.5 py-0.5 hover:bg-gold hover:text-navy"
                >
                  {i + 1}
                </button>
              ))
            )}
          </div>
        )}

        {pendingSelection && (
          <button
            type="button"
            onClick={confirmHighlight}
            className="rounded-sm bg-gold px-2 py-1 text-xs text-navy hover:bg-gold/80"
          >
            Highlight selection
          </button>
        )}

        <Button variant="toolbar" className="ml-auto" onClick={addBookmark}>
          Bookmark this location
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-surface">
        <div
          ref={contentRef}
          onMouseUp={handleMouseUp}
          className="relative mx-auto max-w-3xl px-10 py-10 text-foreground prose"
          style={{ fontSize: `${FONT_STEPS[fontStepIndex]}%` }}
        >
          {loadError ? (
            <p className="text-sm text-muted">Couldn&apos;t load this document.</p>
          ) : html === null ? (
            <p className="text-sm text-muted">Loading document…</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}

          {highlights.map((a) => {
            const h = a.highlightData as DocxHighlightData;
            return h.rects.map((r, i) => (
              <div
                key={`${a.id}-${i}`}
                className="pointer-events-none absolute bg-gold/35"
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              />
            ));
          })}
        </div>
      </div>
    </div>
  );
}
