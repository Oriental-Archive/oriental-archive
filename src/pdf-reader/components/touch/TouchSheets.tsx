import {
  Download,
  FileText,
  Info,
  LibraryBig,
  Highlighter,
  Maximize,
  Minus,
  PenLine,
  Plus,
  Printer,
  Redo2,
  Square,
  StickyNote,
  Settings2,
  Eye,
  EyeOff,
  Undo2,
  X,
} from "lucide-react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import type { Bookmark, OutlineNode, ToolId } from "@/pdf-reader/types";
import type { SearchMatch, SearchOptions } from "@/pdf-reader/hooks/usePdfSearch";
import { BottomSheet } from "@/pdf-reader/components/common/BottomSheet";
import { DocumentOutline } from "@/pdf-reader/components/layout/DocumentOutline";
import { PageThumbnails } from "@/pdf-reader/components/layout/PageThumbnails";
import { BookmarkPanel } from "@/pdf-reader/components/layout/BookmarkPanel";
import { DocumentSearch } from "@/pdf-reader/components/layout/DocumentSearch";

export type NavTab = "contents" | "pages" | "bookmarks" | "search";

const NAV_TABS: { id: NavTab; label: string }[] = [
  { id: "contents", label: "Contents" },
  { id: "pages", label: "Pages" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "search", label: "Search" },
];

/** Table of contents, page grid, bookmarks and search results in one sheet — the "navigation panel" that replaces the desktop left sidebar. */
export function NavigationSheet({
  tab,
  onTab,
  onClose,
  pdf,
  numPages,
  currentPage,
  rotation,
  flipVertical,
  outline,
  bookmarks,
  onNavigate,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  search,
}: {
  tab: NavTab;
  onTab: (t: NavTab) => void;
  onClose: () => void;
  pdf: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  outline: OutlineNode[];
  bookmarks: Bookmark[];
  onNavigate: (page: number) => void;
  onAddBookmark: () => void;
  onUpdateBookmark: (id: string, patch: Partial<Bookmark>) => void;
  onDeleteBookmark: (id: string) => void;
  search: {
    query: string;
    options: SearchOptions;
    onOptionsChange: (o: SearchOptions) => void;
    matches: SearchMatch[];
    activeIndex: number;
    onActiveIndexChange: (i: number) => void;
    searching: boolean;
    noTextLayer: boolean;
    onSearch: (q: string) => void;
  };
}) {
  // Jumping somewhere is the whole point of this sheet — get out of the way once you have.
  const go = (page: number) => {
    onNavigate(page);
    onClose();
  };
  return (
    <BottomSheet title="Navigate" onClose={onClose} size="fill" hideTitle padded={false}>
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center border-b border-border pl-2">
          <div role="tablist" className="flex flex-1 overflow-x-auto">
            {NAV_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => onTab(t.id)}
                className={`min-h-11 flex-1 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors ${
                  tab === t.id ? "border-accent text-accent" : "border-transparent text-text-muted"
                }`}
              >
                {t.label}
                {t.id === "bookmarks" && bookmarks.length > 0 && <span className="ml-1 text-[11px] opacity-70">{bookmarks.length}</span>}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {tab === "contents" && <DocumentOutline outline={outline} currentPage={currentPage} onNavigate={go} />}
          {tab === "pages" && (
            <PageThumbnails
              pdf={pdf}
              numPages={numPages}
              currentPage={currentPage}
              rotation={rotation}
              flipVertical={flipVertical}
              onSelect={go}
              columns={3}
            />
          )}
          {tab === "bookmarks" && (
            <BookmarkPanel
              bookmarks={bookmarks}
              currentPage={currentPage}
              onNavigate={go}
              onAdd={onAddBookmark}
              onUpdate={onUpdateBookmark}
              onDelete={onDeleteBookmark}
            />
          )}
          {tab === "search" && <DocumentSearch {...search} onNavigate={go} />}
        </div>
      </div>
    </BottomSheet>
  );
}

function Row({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center gap-4 rounded-lg px-2 text-left text-[15px] text-text-primary transition-colors active:bg-surface-hover disabled:opacity-40"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-text-secondary">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[12px] text-text-muted">{hint}</span>}
    </button>
  );
}

/** Everything that shouldn't clutter the reading view, in one thumb-friendly list. */
export function MoreSheet({
  onClose,
  onInfo,
  onCitation,
  onSettings,
  onDownload,
  onPrint,
  onFullscreen,
  fullscreenSupported,
  isFullscreen,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  annotationsVisible,
  onToggleAnnotations,
  onExit,
  onTool,
}: {
  onClose: () => void;
  onInfo: () => void;
  onCitation: () => void;
  onSettings: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  onFullscreen: () => void;
  fullscreenSupported: boolean;
  isFullscreen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  annotationsVisible: boolean;
  onToggleAnnotations: () => void;
  onExit: () => void;
  /** Arm a drawing/marking tool (pen, area, note pins…) — text markup uses the selection bar instead. */
  onTool: (t: ToolId) => void;
}) {
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <BottomSheet title="More" onClose={onClose}>
      <div className="pb-3">
        <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Draw & mark</p>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={run(() => onTool(t.id))}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border text-[11px] text-text-secondary active:bg-surface-hover"
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className="my-1 h-px bg-border" />
        <Row icon={<Undo2 size={20} />} label="Undo annotation change" disabled={!canUndo} onClick={() => onUndo()} />
        <Row icon={<Redo2 size={20} />} label="Redo" disabled={!canRedo} onClick={() => onRedo()} />
        <div className="my-1 h-px bg-border" />
        <Row icon={<LibraryBig size={20} />} label="Citations & references" onClick={run(onCitation)} />
        <Row icon={<Info size={20} />} label="Document information" onClick={run(onInfo)} />
        <Row
          icon={annotationsVisible ? <EyeOff size={20} /> : <Eye size={20} />}
          label={annotationsVisible ? "Hide annotations" : "Show annotations"}
          onClick={run(onToggleAnnotations)}
        />
        <Row icon={<Settings2 size={20} />} label="Reader settings" onClick={run(onSettings)} />
        <div className="my-1 h-px bg-border" />
        {onDownload && <Row icon={<Download size={20} />} label="Download PDF" onClick={run(onDownload)} />}
        {onPrint && <Row icon={<Printer size={20} />} label="Print" onClick={run(onPrint)} />}
        {fullscreenSupported && (
          <Row icon={<Maximize size={20} />} label={isFullscreen ? "Exit full screen" : "Full screen"} onClick={run(onFullscreen)} />
        )}
        <div className="my-1 h-px bg-border" />
        <Row icon={<FileText size={20} />} label="Back to book" onClick={run(onExit)} />
      </div>
    </BottomSheet>
  );
}

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "draw", label: "Pen", icon: <PenLine size={18} /> },
  { id: "area", label: "Area box", icon: <Square size={18} /> },
  { id: "note", label: "Note pin", icon: <StickyNote size={18} /> },
  { id: "highlight", label: "Highlighter", icon: <Highlighter size={18} /> },
];

const PRESETS: { label: string; apply: "fit-width" | "fit-page" | number }[] = [
  { label: "Fit width", apply: "fit-width" },
  { label: "Fit page", apply: "fit-page" },
  { label: "100%", apply: 1 },
  { label: "125%", apply: 1.25 },
  { label: "150%", apply: 1.5 },
  { label: "200%", apply: 2 },
];

/** The percentage is a readout of wherever pinching left you; these are shortcuts, not the only sizes. */
export function ZoomSheet({
  onClose,
  percent,
  zoomMode,
  onPreset,
  onStep,
}: {
  onClose: () => void;
  percent: number;
  zoomMode: string;
  onPreset: (p: "fit-width" | "fit-page" | number) => void;
  onStep: (delta: number) => void;
}) {
  return (
    <BottomSheet title="Zoom" onClose={onClose}>
      <div className="pb-4">
        <div className="mb-4 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => onStep(-0.1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-text-secondary active:bg-surface-hover"
          >
            <Minus size={20} />
          </button>
          <div className="min-w-24 text-center">
            <div className="text-[28px] font-light tabular-nums text-text-primary">{percent}%</div>
            <div className="text-[11px] text-text-muted">{zoomMode === "custom" ? "Custom" : zoomMode === "fit-page" ? "Fit page" : zoomMode === "fit-width" ? "Fit width" : "Actual size"}</div>
          </div>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => onStep(0.1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-text-secondary active:bg-surface-hover"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                onPreset(p.apply);
                onClose();
              }}
              className="min-h-11 rounded-lg border border-border text-[13px] text-text-secondary active:bg-surface-hover"
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-text-muted">Pinch anywhere on the page to zoom to any size.</p>
      </div>
    </BottomSheet>
  );
}

