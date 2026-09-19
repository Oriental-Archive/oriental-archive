import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Sun,
  Moon,
  Settings2,
  MoreVertical,
  Maximize,
  Columns2,
  ScrollText,
  Library,
  Command,
  PanelRight,
  Menu,
} from "lucide-react";
import type { ReaderMode } from "@/pdf-reader/types";
import { IconButton } from "@/pdf-reader/components/common/IconButton";
import { ReaderStatus } from "@/pdf-reader/components/status/ReaderStatus";
import type { SaveStatus } from "@/pdf-reader/types";

export function ReaderHeader({
  title,
  author,
  currentPage,
  numPages,
  onJumpToPage,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onOpenSearch,
  onOpenLeftSidebar,
  readerMode,
  onSetReaderMode,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenShortcuts,
  onOpenCommandPalette,
  onOpenInfo,
  onExportAnnotations,
  onDownload,
  onPrint,
  onBack,
  saveStatus,
  rightPanelOpen,
  onToggleRightPanel,
  compact = false,
}: {
  title: string;
  author: string | null;
  currentPage: number;
  numPages: number | null;
  onJumpToPage: (page: number) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenSearch: () => void;
  /** Opens the left sidebar drawer — only used in compact mode, where there's no rail to click. */
  onOpenLeftSidebar: () => void;
  readerMode: ReaderMode;
  onSetReaderMode: (m: ReaderMode) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette: () => void;
  onOpenInfo: () => void;
  onExportAnnotations: () => void;
  /** Absent when the book doesn't permit downloading; the menu item is then not offered. */
  onDownload?: () => void;
  onPrint?: () => void;
  /** Back to the book's page. */
  onBack: () => void;
  saveStatus: SaveStatus;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  /** Tablet/mobile: trims secondary controls into the overflow menu and shows a drawer toggle instead of the rail. */
  compact?: boolean;
}) {
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [moreOpen, setMoreOpen] = useState(false);
  const pageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== pageInputRef.current) setPageInput(String(currentPage));
  }, [currentPage]);

  function run(fn: () => void) {
    fn();
    setMoreOpen(false);
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 sm:gap-3 sm:px-3">
      {compact && (
        <IconButton label="Browse document" onClick={onOpenLeftSidebar}>
          <Menu size={17} />
        </IconButton>
      )}

      {!compact && (
        <>
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-text-secondary hover:bg-surface-hover hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Library size={16} />
            Back to book
          </button>

          <div className="mx-1 h-5 w-px bg-border" />
        </>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <p dir="auto" className="truncate font-serif text-sm font-medium text-text-primary">{title}</p>
          {author && !compact && (
            <p dir="auto" className="truncate text-[11px] text-text-muted">
              {author}
            </p>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-0.5">
          <IconButton label="Back" disabled={!canGoBack} onClick={onGoBack}>
            <ArrowLeft size={15} />
          </IconButton>
          <IconButton label="Forward" disabled={!canGoForward} onClick={onGoForward}>
            <ArrowRight size={15} />
          </IconButton>
        </div>
      )}

      {numPages && (
        <div className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
          <input
            ref={pageInputRef}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => onJumpToPage(Number(pageInput) || currentPage)}
            onKeyDown={(e) => e.key === "Enter" && onJumpToPage(Number(pageInput) || currentPage)}
            aria-label="Current page"
            className="w-10 rounded-md border border-border bg-transparent px-1 py-0.5 text-center focus-visible:outline-2 focus-visible:outline-accent"
          />
          <span>/ {numPages}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <IconButton label="Search document" shortcut="Mod+F" onClick={onOpenSearch}>
          <Search size={15} />
        </IconButton>
        {!compact && (
          <IconButton label="Command palette" shortcut="Mod+K" onClick={onOpenCommandPalette}>
            <Command size={15} />
          </IconButton>
        )}
        <IconButton
          label="Research panel"
          shortcut="Mod+Shift+R"
          active={rightPanelOpen}
          onClick={onToggleRightPanel}
        >
          <PanelRight size={15} />
        </IconButton>

        {!compact && (
          <>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <IconButton label="Continuous" active={readerMode === "standard"} onClick={() => onSetReaderMode("standard")}>
              <ScrollText size={15} />
            </IconButton>
            <IconButton label="Focus mode" shortcut="Mod+Shift+F" active={readerMode === "focus"} onClick={() => onSetReaderMode("focus")}>
              <Columns2 size={15} />
            </IconButton>
            <IconButton label="Presentation mode" active={readerMode === "presentation"} onClick={() => onSetReaderMode("presentation")}>
              <Maximize size={15} />
            </IconButton>
          </>
        )}

        <div className="mx-0.5 h-5 w-px bg-border" />

        <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onToggleTheme}>
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>
        {!compact && (
          <IconButton label="Reader settings" onClick={onOpenSettings}>
            <Settings2 size={15} />
          </IconButton>
        )}

        <div className="relative">
          <IconButton label="More actions" onClick={() => setMoreOpen((o) => !o)}>
            <MoreVertical size={15} />
          </IconButton>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="absolute top-full right-0 z-40 mt-1 w-52 rounded-lg border border-border bg-surface-elevated py-1 shadow-md">
                {compact && (
                  <>
                    <MenuItem label="Reader settings" onClick={() => run(onOpenSettings)} />
                    <MenuItem label="Command palette" onClick={() => run(onOpenCommandPalette)} />
                    <div className="my-1 h-px bg-border" />
                    <MenuItem
                      label={readerMode === "standard" ? "Focus mode" : "Standard mode"}
                      onClick={() => run(() => onSetReaderMode(readerMode === "standard" ? "focus" : "standard"))}
                    />
                    <MenuItem label="Presentation mode" onClick={() => run(() => onSetReaderMode("presentation"))} />
                    <div className="my-1 h-px bg-border" />
                  </>
                )}
                <MenuItem label="Document information" onClick={() => run(onOpenInfo)} />
                <MenuItem label="Export annotations…" onClick={() => run(onExportAnnotations)} />
                {onDownload && <MenuItem label="Download PDF" onClick={() => run(onDownload)} />}
                {onPrint && <MenuItem label="Print…" onClick={() => run(onPrint)} />}
                <MenuItem label="Keyboard shortcuts" onClick={() => run(onOpenShortcuts)} />
              </div>
            </>
          )}
        </div>

        <div className="ml-1 hidden sm:block">
          <ReaderStatus status={saveStatus} />
        </div>
      </div>
    </header>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover"
    >
      {label}
    </button>
  );
}
