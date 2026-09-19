import { FileText, ListTree, Bookmark as BookmarkIcon, Search, PanelLeftClose, Pin, PinOff } from "lucide-react";
import type { Bookmark, OutlineNode } from "@/pdf-reader/types";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import type { SearchMatch, SearchOptions } from "@/pdf-reader/hooks/usePdfSearch";
import { PageThumbnails } from "@/pdf-reader/components/layout/PageThumbnails";
import { DocumentOutline } from "@/pdf-reader/components/layout/DocumentOutline";
import { BookmarkPanel } from "@/pdf-reader/components/layout/BookmarkPanel";
import { DocumentSearch } from "@/pdf-reader/components/layout/DocumentSearch";
import { Tooltip } from "@/pdf-reader/components/common/Tooltip";

export type LeftTab = "pages" | "outline" | "bookmarks" | "search";

const TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "pages", label: "Pages", icon: <FileText size={16} /> },
  { id: "outline", label: "Outline", icon: <ListTree size={16} /> },
  { id: "bookmarks", label: "Bookmarks", icon: <BookmarkIcon size={16} /> },
  { id: "search", label: "Search", icon: <Search size={16} /> },
];

export function LeftSidebar({
  open,
  variant = "panel",
  activeTab,
  onTabChange,
  onToggleOpen,
  pdf,
  numPages,
  currentPage,
  rotation,
  flipVertical,
  onNavigate,
  outline,
  bookmarks,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  search,
  canDock = false,
  docked = false,
  onToggleDock,
}: {
  open: boolean;
  /** "panel" pushes the PDF viewport aside (desktop); "drawer" overlays it with a backdrop (tablet/mobile). */
  variant?: "panel" | "drawer";
  activeTab: LeftTab;
  onTabChange: (t: LeftTab) => void;
  onToggleOpen: () => void;
  /** Below the desktop breakpoint, lets the user pin this drawer open as a permanent panel instead. */
  canDock?: boolean;
  docked?: boolean;
  onToggleDock?: () => void;
  pdf: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  onNavigate: (page: number) => void;
  outline: OutlineNode[];
  bookmarks: Bookmark[];
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
  if (!open) {
    if (variant === "drawer") return null;
    return (
      <nav className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2">
        {TABS.map((tab) => (
          <Tooltip key={tab.id} label={tab.label}>
            <button
              type="button"
              onClick={() => {
                onTabChange(tab.id);
                onToggleOpen();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
            >
              {tab.icon}
            </button>
          </Tooltip>
        ))}
      </nav>
    );
  }

  const content = (
    <div
      className={
        variant === "drawer"
          ? "fixed inset-y-0 left-0 z-40 flex w-[85vw] max-w-xs flex-col border-r border-border bg-surface shadow-xl"
          : "flex w-72 shrink-0 flex-col border-r border-border bg-surface"
      }
    >
      <div className="flex items-center justify-between border-b border-border pr-1">
        <div role="tablist" className="flex flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-2.5 text-[10.5px] font-medium transition-colors [@media(pointer:coarse)]:py-3 ${
                activeTab === tab.id ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {canDock && (
          <Tooltip label={docked ? "Undock (overlay when collapsed)" : "Dock (keep visible alongside the page)"}>
            <button
              type="button"
              onClick={onToggleDock}
              aria-pressed={docked}
              className={`flex h-7 w-7 items-center justify-center rounded-md [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 ${
                docked ? "text-accent" : "text-text-muted hover:bg-surface-hover"
              }`}
            >
              {docked ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          </Tooltip>
        )}
        <Tooltip label="Collapse sidebar" shortcut="Mod+Shift+L">
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
          >
            <PanelLeftClose size={15} />
          </button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "pages" && (
          <PageThumbnails
            pdf={pdf}
            numPages={numPages}
            currentPage={currentPage}
            rotation={rotation}
            flipVertical={flipVertical}
            onSelect={onNavigate}
          />
        )}
        {activeTab === "outline" && <DocumentOutline outline={outline} currentPage={currentPage} onNavigate={onNavigate} />}
        {activeTab === "bookmarks" && (
          <BookmarkPanel
            bookmarks={bookmarks}
            currentPage={currentPage}
            onNavigate={onNavigate}
            onAdd={onAddBookmark}
            onUpdate={onUpdateBookmark}
            onDelete={onDeleteBookmark}
          />
        )}
        {activeTab === "search" && (
          <DocumentSearch
            query={search.query}
            options={search.options}
            onOptionsChange={search.onOptionsChange}
            matches={search.matches}
            activeIndex={search.activeIndex}
            onActiveIndexChange={search.onActiveIndexChange}
            searching={search.searching}
            noTextLayer={search.noTextLayer}
            onSearch={search.onSearch}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );

  if (variant === "drawer") {
    return (
      <div className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/30" onClick={onToggleOpen} />
        {content}
      </div>
    );
  }
  return content;
}
