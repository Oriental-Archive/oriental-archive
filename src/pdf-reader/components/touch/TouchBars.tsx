import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Highlighter,
  ListTree,
  MoreHorizontal,
  ScrollText,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import type { ReadingMode } from "@/pdf-reader/types";
import { BarButton, TouchButton } from "@/pdf-reader/components/touch/TouchButton";
import { PageScrubber } from "@/pdf-reader/components/touch/PageScrubber";

/** Both bars slide fully out of view (and out of the tab order's reach visually) when hidden, but stay in the DOM so keyboard focus can bring them back. */
const barBase = "pointer-events-auto absolute inset-x-0 z-30 bg-surface/95 backdrop-blur no-callout transition-transform duration-200 ease-out";
const sidePad = { paddingLeft: "var(--sal)", paddingRight: "var(--sar)" };

export function TouchTopBar({
  visible,
  title,
  chapter,
  bookmarked,
  onExit,
  onToggleBookmark,
  onSearch,
  onMore,
}: {
  visible: boolean;
  title: string;
  chapter: string | null;
  bookmarked: boolean;
  onExit: () => void;
  onToggleBookmark: () => void;
  onSearch: () => void;
  onMore: () => void;
}) {
  return (
    <header
      data-no-gesture=""
      className={`${barBase} top-0 border-b border-border`}
      style={{ ...sidePad, paddingTop: "var(--sat)", transform: visible ? "none" : "translateY(-100%)" }}
      aria-hidden={!visible}
    >
      <div className="flex h-12 items-center gap-0.5 px-1">
        <TouchButton label="Back to book" onClick={onExit}>
          <ArrowLeft size={20} />
        </TouchButton>
        <div className="min-w-0 flex-1 px-1">
          <p dir="auto" className="truncate font-serif text-[15px] font-medium leading-tight text-text-primary">{title}</p>
          {chapter && <p className="truncate text-[11px] leading-tight text-text-muted">{chapter}</p>}
        </div>
        <TouchButton label={bookmarked ? "Remove bookmark" : "Bookmark this page"} active={bookmarked} onClick={onToggleBookmark}>
          {bookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </TouchButton>
        <TouchButton label="Search" onClick={onSearch}>
          <Search size={20} />
        </TouchButton>
        <TouchButton label="More" onClick={onMore}>
          <MoreHorizontal size={20} />
        </TouchButton>
      </div>
    </header>
  );
}

export function TouchBottomBar({
  visible,
  page,
  numPages,
  onSeek,
  onStep,
  readingMode,
  onToggleReadingMode,
  zoomPercent,
  onOpenZoom,
  onOpenContents,
  onOpenAnnotations,
  onOpenDisplay,
  onScrubbingChange,
  pdf,
  pageAspect,
  rotation,
  flipVertical,
  chapterOf,
}: {
  visible: boolean;
  page: number;
  numPages: number;
  onSeek: (page: number) => void;
  /** Present only in page-turn mode: previous/next buttons, the non-gesture way to turn a page. */
  onStep?: (delta: number) => void;
  readingMode: ReadingMode;
  onToggleReadingMode: () => void;
  zoomPercent: number;
  onOpenZoom: () => void;
  onOpenContents: () => void;
  onOpenAnnotations: () => void;
  onOpenDisplay: () => void;
  onScrubbingChange: (scrubbing: boolean) => void;
  pdf: PDFDocumentProxy;
  pageAspect: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  chapterOf: (page: number) => string | null;
}) {
  return (
    <footer
      data-no-gesture=""
      className={`${barBase} bottom-0 border-t border-border`}
      style={{ ...sidePad, paddingBottom: "var(--sab)", transform: visible ? "none" : "translateY(100%)" }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-1 px-2 pt-1">
        {onStep && (
          <TouchButton label="Previous page" disabled={page <= 1} onClick={() => onStep(-1)}>
            <ChevronLeft size={20} />
          </TouchButton>
        )}
        <span className="min-w-[3.6rem] text-center text-[12px] tabular-nums text-text-secondary">
          {page} <span className="text-text-muted">/ {numPages}</span>
        </span>
        <PageScrubber
          page={page}
          numPages={numPages}
          onSeek={onSeek}
          onScrubbingChange={onScrubbingChange}
          pdf={pdf}
          pageAspect={pageAspect}
          rotation={rotation}
          flipVertical={flipVertical}
          chapterOf={chapterOf}
        />
        {onStep && (
          <TouchButton label="Next page" disabled={page >= numPages} onClick={() => onStep(1)}>
            <ChevronRight size={20} />
          </TouchButton>
        )}
        <button
          type="button"
          onClick={onOpenZoom}
          aria-label={`Zoom ${zoomPercent} percent. Change zoom`}
          className="min-h-11 min-w-12 rounded-md px-1 text-[12px] tabular-nums text-text-secondary active:bg-surface-hover"
        >
          {zoomPercent}%
        </button>
      </div>
      <div className="flex items-stretch px-1 pb-1">
        <BarButton label="Contents" icon={<ListTree size={20} />} onClick={onOpenContents} />
        <BarButton label="Annotations" icon={<Highlighter size={20} />} onClick={onOpenAnnotations} />
        <BarButton
          label={readingMode === "scroll" ? "Scroll" : "Pages"}
          icon={readingMode === "scroll" ? <ScrollText size={20} /> : <BookOpen size={20} />}
          onClick={onToggleReadingMode}
        />
        <BarButton label="Display" icon={<Settings2 size={20} />} onClick={onOpenDisplay} />
      </div>
    </footer>
  );
}

/** Replaces the top bar while searching: a plain field, submit with the keyboard's Search key. */
export function TouchSearchBar({
  query,
  searching,
  onSubmit,
  onClose,
}: {
  query: string;
  searching: boolean;
  onSubmit: (query: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <header
      data-no-gesture=""
      className={`${barBase} top-0 border-b border-border`}
      style={{ ...sidePad, paddingTop: "var(--sat)" }}
    >
      <form
        className="flex h-12 items-center gap-1 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(draft);
          inputRef.current?.blur(); // drop the keyboard so the result and its controls are visible
        }}
      >
        <TouchButton label="Close search" onClick={onClose}>
          <ArrowLeft size={20} />
        </TouchButton>
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search in document"
            aria-label="Search in document"
            className="h-10 w-full rounded-lg border border-border bg-background-secondary pr-9 pl-9 text-[16px] text-text-primary outline-none focus:border-accent"
          />
          {draft && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                setDraft("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-0 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-text-muted"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <span className="w-12 text-center text-[11px] text-text-muted">{searching ? "…" : ""}</span>
      </form>
    </header>
  );
}

/** Bottom search controls: big prev/next at thumb height, lifted above the keyboard. */
export function TouchSearchControls({
  query,
  total,
  activeIndex,
  searching,
  onStep,
  onOpenResults,
}: {
  query: string;
  total: number;
  activeIndex: number;
  searching: boolean;
  onStep: (delta: number) => void;
  onOpenResults: () => void;
}) {
  return (
    <footer
      data-no-gesture=""
      className={`${barBase} border-t border-border`}
      style={{ ...sidePad, bottom: "var(--kb)", paddingBottom: "var(--sab)" }}
    >
      <div className="flex h-14 items-center justify-between px-2">
        <TouchButton label="Previous match" disabled={total === 0} onClick={() => onStep(-1)} className="h-12 w-14">
          <ChevronUp size={22} />
        </TouchButton>
        <button type="button" onClick={onOpenResults} disabled={!query} className="min-h-11 flex-1 px-3 text-center text-[13px] text-text-secondary disabled:opacity-50">
          {searching ? "Searching…" : !query ? "Enter a word or phrase" : total === 0 ? "No matches" : (
            <>
              <span className="font-medium tabular-nums text-text-primary">{activeIndex + 1}</span> of {total} matches
              <span className="ml-2 text-accent">List</span>
            </>
          )}
        </button>
        <TouchButton label="Next match" disabled={total === 0} onClick={() => onStep(1)} className="h-12 w-14">
          <ChevronDown size={22} />
        </TouchButton>
      </div>
    </footer>
  );
}
