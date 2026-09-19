import { useState } from "react";
import {
  MousePointer2,
  Hand,
  Highlighter,
  Underline,
  Strikethrough,
  PenLine,
  StickyNote,
  Square,
  Bookmark,
  BookmarkCheck,
  Copy,
  MoreHorizontal,
  Undo2,
  Redo2,
  Columns2,
  FileStack,
  ScrollText,
} from "lucide-react";
import type { HighlightColor, LayoutMode, ToolId, ZoomMode } from "@/pdf-reader/types";
import { IconButton } from "@/pdf-reader/components/common/IconButton";
import { ZoomControl } from "@/pdf-reader/components/toolbar/ZoomControl";
import { RotateControl } from "@/pdf-reader/components/toolbar/RotateControl";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";

type ToolEntry = { id: ToolId; label: string; shortcut?: string; icon: React.ReactNode; compactOverflow?: boolean };

// compactOverflow entries move from the primary row into the "more" menu on
// tablet/mobile, in the same order they'd otherwise appear inline.
const PRIMARY_TOOLS: ToolEntry[] = [
  { id: "select", label: "Select", icon: <MousePointer2 size={15} /> },
  { id: "pan", label: "Pan", icon: <Hand size={15} />, compactOverflow: true },
  { id: "highlight", label: "Highlight", shortcut: "H", icon: <Highlighter size={15} /> },
  { id: "underline", label: "Underline", icon: <Underline size={15} />, compactOverflow: true },
  { id: "strikethrough", label: "Strikethrough", icon: <Strikethrough size={15} />, compactOverflow: true },
];
const MORE_TOOLS: ToolEntry[] = [
  { id: "draw", label: "Freehand drawing", icon: <PenLine size={15} /> },
  { id: "note", label: "Text note", icon: <StickyNote size={15} /> },
  { id: "area", label: "Area note", icon: <Square size={15} /> },
];

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

export function ReaderToolbar({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  layoutMode,
  onLayoutModeChange,
  zoomMode,
  scale,
  onSetZoomMode,
  onZoomIn,
  onZoomOut,
  onRotateCW,
  onRotateCCW,
  flipVertical,
  onToggleFlipVertical,
  bookmarked,
  onBookmark,
  onCopySelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  compact = false,
}: {
  activeTool: ToolId;
  onToolChange: (t: ToolId) => void;
  color: HighlightColor;
  onColorChange: (c: HighlightColor) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (m: LayoutMode) => void;
  zoomMode: ZoomMode;
  scale: number;
  onSetZoomMode: (m: ZoomMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  flipVertical: boolean;
  onToggleFlipVertical: () => void;
  bookmarked: boolean;
  onBookmark: () => void;
  onCopySelection: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Tablet/mobile: fewer tools inline, the rest move into the overflow menu. */
  compact?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTools = compact ? PRIMARY_TOOLS.filter((t) => !t.compactOverflow) : PRIMARY_TOOLS;
  const moreTools = compact ? [...PRIMARY_TOOLS.filter((t) => t.compactOverflow), ...MORE_TOOLS] : MORE_TOOLS;
  const isMoreActive = moreTools.some((t) => t.id === activeTool);

  return (
    <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
      <div className="flex shrink-0 items-center gap-0.5">
        {primaryTools.map((t) => (
          <IconButton
            key={t.id}
            label={t.label}
            shortcut={t.shortcut}
            active={activeTool === t.id}
            onClick={() => onToolChange(t.id)}
          >
            {t.icon}
          </IconButton>
        ))}

        <div className="relative">
          <IconButton label="More annotation tools" active={isMoreActive} onClick={() => setMoreOpen((o) => !o)}>
            {moreTools.find((t) => t.id === activeTool)?.icon ?? <MoreHorizontal size={15} />}
          </IconButton>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="absolute top-full left-0 z-40 mt-1 w-44 rounded-lg border border-border bg-surface-elevated py-1 shadow-md">
                {moreTools.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onToolChange(t.id);
                      setMoreOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-hover ${
                      activeTool === t.id ? "font-medium text-accent" : "text-text-secondary"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {activeTool !== "select" && activeTool !== "pan" && (
        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => onColorChange(c)}
              className="h-4 w-4 shrink-0 rounded-full"
              style={{
                background: HIGHLIGHT_COLOR_VARS[c],
                outline: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
      )}

      <div className="mx-1 h-5 w-px shrink-0 bg-border" />
      <IconButton label="Undo" shortcut="Mod+Z" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={15} />
      </IconButton>
      <IconButton label="Redo" shortcut="Mod+Shift+Z" disabled={!canRedo} onClick={onRedo}>
        <Redo2 size={15} />
      </IconButton>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" />
      <IconButton label={bookmarked ? "Remove bookmark" : "Bookmark page"} shortcut="B" active={bookmarked} onClick={onBookmark}>
        {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
      </IconButton>
      <IconButton label="Copy selection" onClick={onCopySelection}>
        <Copy size={15} />
      </IconButton>

      {!compact && (
        <RotateControl
          flipVertical={flipVertical}
          onRotateCW={onRotateCW}
          onRotateCCW={onRotateCCW}
          onToggleFlipVertical={onToggleFlipVertical}
        />
      )}

      <div className="mx-1 h-5 w-px shrink-0 bg-border" />
      <IconButton label="Continuous scroll" active={layoutMode === "continuous"} onClick={() => onLayoutModeChange("continuous")}>
        <ScrollText size={15} />
      </IconButton>
      <IconButton label="Single page" active={layoutMode === "single"} onClick={() => onLayoutModeChange("single")}>
        <FileStack size={15} />
      </IconButton>
      <IconButton label="Two-page spread" active={layoutMode === "two-page"} onClick={() => onLayoutModeChange("two-page")}>
        <Columns2 size={15} />
      </IconButton>

      <div className="ml-auto shrink-0 pl-1">
        <ZoomControl zoomMode={zoomMode} scale={scale} onSetMode={onSetZoomMode} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
      </div>
    </div>
  );
}
