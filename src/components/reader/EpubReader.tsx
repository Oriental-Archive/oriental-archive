"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import ePub, { type Book, type Rendition } from "epubjs";
import type { ReaderApi, SubReaderProps } from "@/components/reader/ReaderShell";
import { Button } from "@/components/ui/Button";

type EpubHighlightData = { cfiRange: string; color: string };
type EpubLocation = { cfi: string };
type SearchMatch = { cfi: string; excerpt: string };
// epubjs's shipped .d.ts mistypes Section.find() as returning DOM Elements;
// at runtime it returns {cfi, excerpt} matches, which is what we rely on.
type EpubSection = { load: (request: unknown) => Promise<unknown>; find: (query: string) => SearchMatch[]; unload: () => void };

const HIGHLIGHT_STYLE = { fill: "#b8962e", "fill-opacity": "0.35" };
const FONT_STEPS = [80, 90, 100, 110, 125, 140, 160, 180];

export function EpubReader({ fileUrl, annotations, onCreate, apiRef }: SubReaderProps) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [fontStepIndex, setFontStepIndex] = useState(2);
  const [pendingSelection, setPendingSelection] = useState<{ cfiRange: string; text: string } | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMatch[] | null>(null);

  useImperativeHandle(apiRef, (): ReaderApi => ({
    jumpTo: (location) => {
      const cfi = (location as EpubLocation)?.cfi;
      if (cfi) renditionRef.current?.display(cfi);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch ourselves (with the session cookie) rather than letting
        // epub.js fetch the URL internally — this endpoint requires auth on
        // its first hop before redirecting to the actual signed file, and we
        // want that cookie sent regardless of epub.js's own fetch defaults.
        const res = await fetch(fileUrl, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch document");
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const book = ePub(buffer);
        bookRef.current = book;
        const rendition = book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          flow: "paginated",
        });
        renditionRef.current = rendition;
        rendition.themes.fontSize(`${FONT_STEPS[fontStepIndex]}%`);

        rendition.on("selected", (cfiRange: string, contents: { window: Window }) => {
          const text = contents.window.getSelection()?.toString().trim();
          if (text) setPendingSelection({ cfiRange, text });
        });

        await book.ready;
        if (cancelled) return;
        await rendition.display();
        for (const a of annotations) {
          const h = a.highlightData as EpubHighlightData | null | undefined;
          if (!h || typeof h.cfiRange !== "string") continue;
          try {
            rendition.annotations.highlight(h.cfiRange, {}, undefined, "epub-highlight", HIGHLIGHT_STYLE);
          } catch {
            // A single malformed/foreign-format highlight (e.g. leftover data
            // from a different document version) must not break the reader
            // for every other highlight and the document itself.
          }
        }
        setReady(true);
      } catch {
        // A network drop, an HTTP error, or a corrupted/unparseable EPUB
        // (ePub() or book.ready throwing) previously left this stuck on
        // "Loading document…" forever with no way to know it had failed.
        if (!cancelled) setLoadError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
    // Annotations are seeded once at initial render only — later additions
    // are drawn immediately at creation time instead of re-running this
    // whole effect (see confirmHighlight).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  function setFontStep(index: number) {
    const clamped = Math.max(0, Math.min(FONT_STEPS.length - 1, index));
    setFontStepIndex(clamped);
    renditionRef.current?.themes.fontSize(`${FONT_STEPS[clamped]}%`);
  }

  async function confirmHighlight() {
    if (!pendingSelection) return;
    const highlightData: EpubHighlightData = { cfiRange: pendingSelection.cfiRange, color: "gold" };
    const ok = await onCreate({
      location: { cfi: pendingSelection.cfiRange } satisfies EpubLocation,
      selectedText: pendingSelection.text,
      highlightData,
    });
    // Drawn only once the save actually sticks — otherwise the rendition
    // would show a highlight that vanishes on the next page load because it
    // was never saved (the sidebar's error message explains why, and the
    // "Highlight selection" button stays up so the same selection can be
    // retried).
    if (!ok) return;
    renditionRef.current?.annotations.highlight(
      pendingSelection.cfiRange,
      {},
      undefined,
      "epub-highlight",
      HIGHLIGHT_STYLE
    );
    setPendingSelection(null);
  }

  async function addBookmark() {
    const location = renditionRef.current?.currentLocation() as { start?: { cfi: string } } | undefined;
    const cfi = location?.start?.cfi;
    if (cfi) await onCreate({ location: { cfi } satisfies EpubLocation });
  }

  async function runSearch() {
    const book = bookRef.current;
    const query = searchQuery.trim();
    if (!book || !query) return;
    setSearching(true);

    const sections: EpubSection[] = [];
    book.spine.each((section: EpubSection) => sections.push(section));

    const results: SearchMatch[] = [];
    try {
      for (const section of sections) {
        await section.load(book.load.bind(book));
        results.push(...section.find(query));
        section.unload();
      }
    } catch {
      // A single unreadable section would otherwise throw mid-loop and
      // leave the Search button stuck reading "…" forever.
    } finally {
      setSearchResults(results);
      setSearching(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-navy px-4 py-2 text-background">
        <div className="flex items-center gap-1">
          <Button variant="toolbar" onClick={() => renditionRef.current?.prev()}>
            ‹ Prev
          </Button>
          <Button variant="toolbar" onClick={() => renditionRef.current?.next()}>
            Next ›
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="toolbar" onClick={() => setFontStep(fontStepIndex - 1)}>
            A−
          </Button>
          <span className="w-10 text-center text-xs">{FONT_STEPS[fontStepIndex]}%</span>
          <Button variant="toolbar" onClick={() => setFontStep(fontStepIndex + 1)}>
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
            {searching ? "…" : "Search"}
          </Button>
        </form>
        {searchResults && (
          <div className="flex max-w-xs items-center gap-1 overflow-x-auto text-xs">
            {searchResults.length === 0 ? (
              <span className="text-background/70">No matches</span>
            ) : (
              searchResults.slice(0, 6).map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => renditionRef.current?.display(m.cfi)}
                  title={m.excerpt}
                  className="shrink-0 rounded-sm border border-gold px-1.5 py-0.5 hover:bg-gold hover:text-navy"
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

      <div className="relative flex-1 bg-surface">
        {loadError && (
          <div className="p-10 text-center text-sm text-muted">Couldn&apos;t load this document.</div>
        )}
        {!ready && !loadError && <div className="p-10 text-center text-sm text-muted">Loading document…</div>}
        <div ref={viewerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
